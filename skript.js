import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, sun;
let solarSystemContainer;
let currentCameraTarget;
let background;
let planets = [];
let hitboxes = [];
let speedFactor = 1;
let lastTime = 0;
let simulatedTime = 0;
let isRotationFrozen = false;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraRadius = 300;
const minDistance = 25;
const maxDistance = 1500;
const cameraSpeed = 0.005;
let cameraTheta = 0;
let cameraPhi = Math.PI / 2;
const lerpFactor = 0.05;
let currentCameraPosition = new THREE.Vector3();
let popupTarget = null;
let hoveredObject = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let highlightHalo = null;
let highlightEnabled = false;
let highlightedObject = null;
let orbitsVisible = true;
const orbitLines = [];
let radius;
let initialPinchDistance = null;
let lastPinchZoom = cameraRadius;

/*class PlanetTrail {
    constructor(color) {
        this.points = [];
        this.trailLength = 5000;
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.LineBasicMaterial({ color: color });
        this.line = new THREE.Line(this.geometry, this.material);
    }

    update(position) {
        this.points.push(position.clone());
        if (this.points.length > this.trailLength) this.points.shift();
        this.geometry.setFromPoints(this.points);
    }
}*/
function getOrbitColor(type) {
    switch (type) {
        case "planet": return 0x00aaff;
        case "transneptunic": return 0xe11818;
        case "comet": return 0xffaa00;
        case "star": return 0xffff00;
        default: return 0xffffff;
    }
}

function createOrbitEllipse(config) {
    const a = config.semiMajorAxis;
    const e = config.eccentricity;
    const inclination = config.inclination * Math.PI / 180;
    const segments = 360;
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        let x, z;

        if (config.type === "comet" && e > 0.6) {
            x = a * (Math.cos(angle) - e);
            z = a * Math.sqrt(1 - e * e) * Math.sin(angle);
        } else {
            const r = a * (1 - e ** 2) / (1 + e * Math.cos(angle));
            x = r * Math.cos(angle);
            z = r * Math.sin(angle);
        }

        points.push(new THREE.Vector3(x, 0, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: getOrbitColor(config.type),
        transparent: true,
        opacity: 0.4
    });
    const ellipse = new THREE.LineLoop(geometry, material);
    if (!(config.type === "comet" && e > 0.6)) {
        ellipse.position.x = -a * e;
    }
    ellipse.rotation.x = inclination;
    return ellipse;
}

function updateCameraPosition(object3D) {
    const worldPos = new THREE.Vector3();
    object3D.getWorldPosition(worldPos);
    const offset = new THREE.Vector3(
        cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta),
        cameraRadius * Math.cos(cameraPhi),
        cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta)
    );
    const desiredPosition = new THREE.Vector3().addVectors(worldPos, offset);
    camera.position.lerp(desiredPosition, lerpFactor);
    camera.lookAt(worldPos);
}

function focusOnPlanet(planetMesh) {
    currentCameraTarget = planetMesh;
    currentCameraPosition.copy(camera.position);

    if (planetMesh.userData.cameraDistance) {
        cameraRadius = planetMesh.userData.cameraDistance;
    } else if (planetMesh === sun) {
        cameraRadius = 20 * 15;
    } else {
        radius = planetMesh.userData.radius || 5;
        cameraRadius = Math.max(minDistance, radius * 15);
    }

    const worldPos = new THREE.Vector3();
    planetMesh.getWorldPosition(worldPos);
    updateCameraPosition(planetMesh);
}

function getPlanetPosition(config, time) {
    const angle = time * config.speed;
    const a = config.semiMajorAxis;
    const e = config.eccentricity;

    if (config.type === "comet" && e > 0.6) {
        const x = a * (Math.cos(angle) - e);
        const z = a * Math.sqrt(1 - e * e) * Math.sin(angle);
        return new THREE.Vector3(x, 0, z);
    }

    const r = a * (1 - e * e) / (1 + e * Math.cos(angle));
    const x = r * Math.cos(angle) - a * e;
    const z = r * Math.sin(angle);
    return new THREE.Vector3(x, 0, z);
}

function initSolarSystem() {
    try {
        solarSystemContainer = document.getElementById("solar-system-container");

        scene = new THREE.Scene();
        const textureLoader = new THREE.TextureLoader();

        const backgroundGeometry = new THREE.SphereGeometry(8500, 64, 64);
        const backgroundMaterial = new THREE.MeshBasicMaterial({
            map: textureLoader.load('textures/1567215018748-ESA_Gaia_DR2_AllSky_Brightness_Colour_Cartesian_2000x1000.png'),
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: true,
            transparent: true,
            opacity: 1
        });
        background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.userData.isBackground = true;
        scene.add(background);

        camera = new THREE.PerspectiveCamera(
            40,
            solarSystemContainer.clientWidth / solarSystemContainer.clientHeight,
            0.1,
            100000
        );
        function createAsteroidBeltInstanced(count = 15000) {
            const innerRadius = 250;
            const outerRadius = 350;
            const minZ = -10;
            const maxZ = 10;

            const geometry = new THREE.SphereGeometry(0.3, 6, 6);
            const material = new THREE.MeshBasicMaterial({ color: 0x1E1E1E});

            const mesh = new THREE.InstancedMesh(geometry, material, count);
            const dummy = new THREE.Object3D();

            for (let i = 0; i < count; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, Math.random());
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                const y = THREE.MathUtils.randFloat(minZ, maxZ);

                dummy.position.set(x, y, z);
                dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }

            scene.add(mesh);
        }
        const planetsConfig = [
            {
                name: "Slunce",
                radius: 22,
                semiMajorAxis: 0,
                eccentricity: 0,
                inclination: 0,
                speed: 0,
                texture: 'textures/2k_sun.jpg',
                color: 0xffff00,
                type: "star",
                info: `Slunce. Jediná a dokonalá hvězda, která nám dovolila vzniknout v nehostinných podmínkách vesmíru. A aktuálně asi jediná hvězda, ke které se v blízké budoucnosti marnotratné lidstvo vypraví.
                <br><a href="https://cs.wikipedia.org/wiki/Slunce" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>
                <br>
                <br>
                Zvuk Slunce
                <br>
                <button onclick="document.getElementById('sun-audio').play()">▶️</button>
                <button onclick="let a = document.getElementById('sun-audio'); a.pause(); a.currentTime = 0;">⏹️</button>
                <audio id="sun-audio">
                <source src="sound/NASA-Sun-Sonification.mp3" type="audio/mpeg">
                </audio>`,
                preview: 'textures/Sun.jpg',
                emissive: 0xffffee,
                emissiveIntensity: 0.7
            },
            { name: "Merkur",
                radius: 3.5,
                semiMajorAxis: 58,
                eccentricity: 0.2056,
                inclination: 7.0,
                speed: 0.0479,
                texture: 'textures/2k_mercury.jpg',
                color: 0x808080,
                type: "planet",
                info: `První planeta Sluneční soustavy. Vzdálenost od Slunce: 58 milionů km. Délka dne a noci: 59 dní. Povrchový tlak: téměř nulový, teplota: −180 °C až +430 °C. Vychýlení oběžné dráhy: 0,206. Oběžná rychlost: 47,9 km/s.
                <br><a href="https://cs.wikipedia.org/wiki/Merkur_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`,
                preview: 'textures/Mercury.jpg'
            },
            { name: "Venuše",
                radius: 6.8,
                semiMajorAxis: 108,
                eccentricity: 0.0068,
                inclination: 3.39,
                speed: 0.0350,
                texture: 'textures/2k_venus_surface.jpg',
                color: 0xffd700,
                type: "planet",
                preview: 'textures/Venus.jpg',
                info: `Druhá planeta Sluneční soustavy. Vzdálenost od Slunce: 108 milionů km. Délka dne a noci: 243 dní (retrográdní rotace). Povrchový tlak: ~92x vyšší než Země, teplota: ~465 °C. Vychýlení oběžné dráhy: 0,007. Oběžná rychlost: 35,0 km/s.
                <br><a href="https://cs.wikipedia.org/wiki/Venu%C5%A1e_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            { name: "Země",
                radius: 7,
                semiMajorAxis: 150,
                eccentricity: 0.0167,
                inclination: 0.00005,
                speed: 0.01,
                texture: 'textures/2k_earth_daymap.jpg',
                color: 0x0000ff,
                type: "planet",
                preview: 'textures/Rotating_earth_animated_transparent.gif',
                info: `Třetí planeta Sluneční soustavy. Vzdálenost od Slunce: 150 milionů km. Délka dne a noci: 24 hodin. Povrchový tlak: 101,3 kPa, teplota: −88 °C až +58 °C. Vychýlení oběžné dráhy: 0,017. Oběžná rychlost: 29,8 km/s."
                <br><a href="https://cs.wikipedia.org/wiki/Zem%C4%9B" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
    },
            { name: "Mars",
                radius: 5.5,
                semiMajorAxis: 208,
                eccentricity: 0.0934,
                inclination: 1.85,
                speed: 0.008,
                texture: 'textures/2k_mars.jpg',
                color: 0xff0000,
                type: "planet",
                preview: 'textures/Mars.jpg',
                info: `Čtvrtá planeta Sluneční soustavy. Vzdálenost od Slunce: 228 milionů km. Délka dne a noci: 24,6 hodiny. Povrchový tlak: ~0,6 kPa, teplota: −125 °C až +20 °C. Vychýlení oběžné dráhy: 0,093. Oběžná rychlost: 24,1 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Mars_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            { name: "Jupiter",
                radius: 11,
                semiMajorAxis: 400,
                eccentricity: 0.0489,
                inclination: 1.304,
                speed: 0.005,
                texture: 'textures/2k_jupiter.jpg',
                color: 0xffa500,
                type: "planet",
                preview: 'textures/Jupiter.jpg',
                info: `Pátá a největší planeta Sluneční soustavy. Vzdálenost od Slunce: 778 milionů km. Délka dne a noci: 9,9 hodin. Povrchový tlak: velmi vysoký (plynný obor), teplota: ~−145 °C. Vychýlení oběžné dráhy: 0,049. Oběžná rychlost: 13,1 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Jupiter_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            { name: "Saturn",
                radius: 10,
                semiMajorAxis: 500,
                eccentricity: 0.0565,
                inclination: 2.485,
                speed: 0.004,
                texture: 'textures/2k_saturn.jpg',
                color: 0xffd700,
                type: "planet",
                preview: 'textures/Saturn.jpg',
                info: `Šestá planeta Sluneční soustavy. Vzdálenost od Slunce: 1,43 miliardy km. Délka dne a noci: 10,7 hodin. Povrchový tlak: vysoký, teplota: ~−178 °C. Vychýlení oběžné dráhy: 0,057. Oběžná rychlost: 9,7 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Saturn_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            { name: "Uran",
                radius: 9,
                semiMajorAxis: 700,
                eccentricity: 0.0463,
                inclination: 0.772,
                speed: 0.003,
                texture: 'textures/2k_uranus.jpg',
                color: 0x00ffff,
                type: "planet",
                preview: 'textures/Uranus.jpg',
                info: `Sedmá planeta Sluneční soustavy. Vzdálenost od Slunce: 2,87 miliardy km. Délka dne a noci: 17,2 hodin. Povrchový tlak: nejasný, teplota: ~−224 °C. Vychýlení oběžné dráhy: 0,046. Oběžná rychlost: 6,8 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Uran_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            { name: "Neptun",
                radius: 8.5,
                semiMajorAxis: 900,
                eccentricity: 0.0095,
                inclination: 1.769,
                speed: 0.002,
                texture: 'textures/2k_neptune.jpg',
                color: 0x0000cd,
                type: "planet",
                preview: 'textures/Neptune.png',
                info: `Osmá planeta Sluneční soustavy. Vzdálenost od Slunce: 4,5 miliardy km. Délka dne a noci: 16 hodin. Povrchový tlak: neznámý, teplota: ~−218 °C. Vychýlení oběžné dráhy: 0,010. Oběžná rychlost: 5,4 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Neptun_(planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Pluto",
                radius: 3,
                semiMajorAxis: 1200,
                eccentricity: 0.2488,
                inclination: 17.16,
                speed: 0.00039,
                texture: 'textures/plu0rss1.jpg',
                color: 0xbfbfbf,
                type: "transneptunic",
                preview: 'textures/Pluto.jpg',
                info: `Trpasličí planeta ve vnější části Sluneční soustavy. Vzdálenost od Slunce: 5,9 miliardy km. Délka dne a noci: 6,4 dne. Povrchový tlak: ~1 Pa, teplota: −229 °C. Vychýlení oběžné dráhy: 0,249. Oběžná rychlost: 4,7 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Pluto_(trpasli%C4%8D%C3%AD_planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Ceres",
                radius: 2.5,
                semiMajorAxis: 414,
                eccentricity: 0.0758,
                inclination: 10.6,
                speed: 0.0027,
                texture: 'textures/2k_ceres_fictional.jpg',
                color: 0x999999,
                type: "transneptunic",
                preview: 'textures/Ceres.jpg',
                info: `Trpasličí planeta a největší objekt hlavního pásu asteroidů. Vzdálenost od Slunce: 414 milionů km. Délka dne a noci: 9 hodin. Povrchový tlak: velmi nízký, teplota: −105 °C. Vychýlení oběžné dráhy: 0,076. Oběžná rychlost: 17,9 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Ceres_(trpasli%C4%8D%C3%AD_planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Haumea",
                radius: 4,
                semiMajorAxis: 1800,
                eccentricity: 0.188,
                inclination: 28.2,
                speed: 0.00029,
                texture: 'textures/2k_haumea_fictional.jpg',
                color: 0xddddff,
                type: "transneptunic",
                preview: 'textures/nodata.png',
                info: `Trpasličí planeta s protáhlým tvarem. Vzdálenost od Slunce: 6,4 miliardy km. Délka dne a noci: 3,9 hodiny (nejrychlejší rotace). Povrchový tlak: žádný, teplota: −241 °C. Vychýlení oběžné dráhy: 0,188. Oběžná rychlost: 4,5 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Haumea_(trpasli%C4%8D%C3%AD_planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Makemake",
                radius: 3.5,
                semiMajorAxis: 2000,
                eccentricity: 0.159,
                inclination: 28.96,
                speed: 0.00026,
                texture: 'textures/2k_makemake_fictional.jpg',
                color: 0xffcccc,
                type: "transneptunic",
                preview: 'textures/nodata.png',
                info: `Trpasličí planeta v Kuiperově pásu. Vzdálenost od Slunce: 6,85 miliardy km. Délka dne a noci: ~7,8 hodiny. Povrchový tlak: téměř nulový, teplota: ~−239 °C. Vychýlení oběžné dráhy: 0,159. Oběžná rychlost: 4,4 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Makemake_(trpasli%C4%8D%C3%AD_planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Eris",
                radius: 3.4,
                semiMajorAxis: 4000,
                eccentricity: 0.44,
                inclination: 44.0,
                speed: 0.00016,
                texture: 'textures/2k_eris_fictional.jpg',
                color: 0xe0e0e0,
                type: "transneptunic",
                preview: 'textures/nodata.png',
                info: `Jedna z největších trpasličích planet. Vzdálenost od Slunce: 10,1 miliardy km. Délka dne a noci: ~25,9 hodiny. Povrchový tlak: žádný, teplota: −231 °C. Vychýlení oběžné dráhy: 0,44. Oběžná rychlost: 3,4 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Eris_(trpasli%C4%8D%C3%AD_planeta)" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Halleyova kometa",
                radius: 1,
                semiMajorAxis: 1200,
                eccentricity: 0.85,
                inclination: 162.26,
                speed: 0.00075,
                texture: 'textures/KOMETA.png',
                color: 0xffffff,
                type: "comet",
                preview: 'textures/Halley.jpg',
                info: `Nejslavnější periodická kometa. Oběh kolem Slunce: 75 let. Vzdálenost od Slunce: 0,6–35 AU. Teplota: ~−70 °C až −220 °C. Vychýlení oběžné dráhy: 0,967. Retrográdní oběžná rychlost: ~54 km/s v perihéliu.
                    <br><a href="https://cs.wikipedia.org/wiki/Halleyova_kometas" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Hale-Boppova kometa",
                radius: 1,
                semiMajorAxis: 2500,
                eccentricity: 0.9,
                inclination: 89.4,
                speed: 0.00009,
                texture: 'textures/KOMETA.png',
                color: 0xccffff,
                type: "comet",
                preview: 'textures/HB.jpg',
                info: `Jasná a výrazná kometa viditelná v roce 1997. Vzdálenost od Slunce: až 370 AU. Délka oběhu: ~2533 let. Vychýlení oběžné dráhy: 0,995. Teplota: ~−200 °C. Rychlost u Slunce: až 45 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/Hale-Bopp" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Enckeova kometa",
                radius: 1,
                semiMajorAxis: 230, //edit z 388 na 220
                eccentricity: 0.75,
                inclination: 11.8,
                speed: 0.0045,
                texture: 'textures/KOMETA.png',
                color: 0xdddddd,
                type: "comet",
                preview: 'textures/Encke.png',
                info: `Kometa s nejkratší známou periodou (~3,3 roku). Vzdálenost od Slunce: 0,34–4,1 AU. Teplota: až 300 °C v perihéliu. Vychýlení oběžné dráhy: 0,85. Rychlost: až 70 km/s.
                    <br><a href="https://cs.wikipedia.org/wiki/2P/Encke" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Kohoutkova kometa",
                radius: 1,
                semiMajorAxis: 230,
                eccentricity: 0.9,
                inclination: 13.3,
                speed: 0.00095,
                texture: 'textures/KOMETA.png',
                color: 0xddddff,
                type: "comet",
                preview: 'textures/Kohoutek.jpg',
                info: `Slavná kometa pozorovaná v roce 1973. Velmi výstřední dráha (téměř parabolická). Oběžná doba: ~75 000 let. Vzdálenost od Slunce: až 350 AU. Vychýlení dráhy: 0,999.
                    <br><a href="https://cs.wikipedia.org/wiki/Kohoutkova_kometa" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            },
            {
                name: "Voyager 2",
                radius: 1.2,
                semiMajorAxis: 5500,
                eccentricity: 0.05,
                inclination: 3,
                speed: 0.00001,
                color: 0xffaa00,
                type: "probe",
                glbPath: "textures/voyager.glb",
                preview: "textures/Voyager.png",
                info: `Voyager 2 je meziplanetární sonda vypuštěná NASA v roce 1977. Je jedinou sondou, která navštívila všechny čtyři obří planety. V roce 2018 opustila heliosféru a nyní putuje mezihvězdným prostorem.
                <br><a href="https://cs.wikipedia.org/wiki/Voyager_2" target="_blank" style="color:#00ff9d;">🔗 Wikipedie</a><br>
                <br>
                Záznam ze Zlaté desky nesené Voyagerem 1 a 2.
                <br>
                <button onclick="document.getElementById('sun-audio').play()">▶️</button>
                <button onclick="let a = document.getElementById('sun-audio'); a.pause(); a.currentTime = 0;">⏹️</button>
                <audio id="sun-audio">
                <source src="sound/Voyager.mp3" type="audio/mpeg">
                </audio>`
            },
            {
                name: "Ha´tak",
                radius: 1.5,
                semiMajorAxis: 8500,
                eccentricity: 0.05,
                inclination: 3,
                speed: 0.00001,
                color: 0xffaa00,
                type: "probe",
                glbPath: "textures/hatak.glb",
                preview: "textures/Hatak.png",
                info: `Ha'tak je třída goa'uldských vesmírných lodí a kdysi byl symbolem prestiže a moci za vlády Goa'uldské říše v galaxii Mléčná dráha.
                <br><a href="https://stargate.fandom.com/wiki/Ha%27tak" target="_blank" style="color:#00ff9d;">🔗 Fandom</a><br>
                <br>`
            },
            {
                name: "Al'kesh",
                radius: 0.8,
                semiMajorAxis: 8500,
                eccentricity: 0.08,
                inclination: 5,
                speed: 0.00001,
                color: 0xffaa00,
                type: "probe",
                glbPath: "textures/alkesh.glb",
                preview: "textures/alkesh.jpg",
                info: `Al'kesh je výkonný goa'uldský bombardér středního doletu a transportér, používaný k útokům na opevněné pozice na planetárním povrchu a sloužící jako podpůrná role během invazí Goa´uldských vládců. Je větší než průzkumná loď Tel'tak a Death Glider, ale mnohem menší než mateřská loď Ha'tak. Po porážce Goa'uldů byl Al'kesh používán také kulturami, které byly dříve pod nadvládou Goa'uldů, jako například Jaffové a Lucijská aliance.
                <br><a href="https://stargate.fandom.com/wiki/Al%27kesh" target="_blank" style="color:#00ff9d;">🔗 Fandom</a><br>
                <br>`
            },
            {
                name: "Rukavice Eda Whitea",
                type: "moon",
                glbPath: "textures/glove.glb",
                preview: "textures/glove.png",
                parentName: "Země",
                orbitRadius: 10,
                speed: THREE.MathUtils.degToRad(4.5),
                initialAngle: Math.random() * Math.PI * 2,
                cameraDistance: 0.8,
                info: `Rukavice ztracená Edem Whitem během výstupu do volného prostoru v roce 1965. Dodnes obíhá Zemi jako miniaturní kus vesmírného odpadu.
    <br>
    <a href="https://en.wikipedia.org/wiki/Edward_Higgins_White" target="_blank" style="color:#00ff9d;">Více o Edovi Whiteovi</a>
    <br><br>
    <a href="https://spacecenter.org/mission-monday-five-fast-facts-about-the-first-american-spacewalk/" target="_blank" style="color:#00ff9d;">O rukavici ;)</a>`
            }
        ];

        const now = Date.now() / 1000;

        planets = planetsConfig.map((config) => {
            const materialOptions = {
                map: textureLoader.load(config.texture),
                specular: 0x111111,
                shininess: 5
            };

            if (config.emissive) {
                materialOptions.emissive = new THREE.Color(config.emissive);
                materialOptions.emissiveIntensity = config.emissiveIntensity || 0.2;
            }
            if (config.glbPath) {
                const loader = new GLTFLoader();
                loader.load(config.glbPath, (gltf) => {
                    const mesh = gltf.scene;
                    mesh.scale.set(1, 1, 1);
                    const position = getPlanetPosition(config, now);
                    mesh.position.set(position.x, 0, position.z);
                    mesh.userData = { ...config, initialTime: now };

                    if (config.type === "moon") {
                        const parent = planets.find(p => p.userData.name === config.parentName);
                        if (parent) mesh.userData.parent = parent;
                    }

                    mesh.traverse(child => {
                        child.userData.ignoreClick = true;
                    });

                    scene.add(mesh);
                    planets.push(mesh);
                    createObjectList(planets);
                }, undefined, (error) => {
                    console.error(`Chyba při načítání ${config.name}:`, error);
                });
                return null;
            }

            function createDeformedCometGeometry(radius) {
                const geometry = new THREE.SphereGeometry(radius, 16, 16);
                const positionAttribute = geometry.attributes.position;

                for (let i = 0; i < positionAttribute.count; i++) {
                    const x = positionAttribute.getX(i);
                    const y = positionAttribute.getY(i);
                    const z = positionAttribute.getZ(i);
                    const scale = THREE.MathUtils.randFloat(0.8, 1.1);
                    positionAttribute.setXYZ(i, x * scale, y * scale, z * scale);
                }

                positionAttribute.needsUpdate = true;
                geometry.computeVertexNormals();

                return geometry;
            }


            let geometry;
            if (config.type === "comet") {
                geometry = createDeformedCometGeometry(config.radius);
            } else {
                geometry = new THREE.SphereGeometry(config.radius, 32, 32);
            }

            const planet = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial(materialOptions));


            const planetGroup = new THREE.Group();
            planetGroup.rotation.x = config.inclination * Math.PI / 180;
            planetGroup.add(planet);

            const hitbox = new THREE.Mesh(
                new THREE.SphereGeometry(config.radius * 3.5, 32, 32),
                new THREE.MeshBasicMaterial({ visible: true, color: 0xff00ff, wireframe: true })
            );
            hitbox.geometry.computeBoundingSphere();
            hitbox.raycast = THREE.Mesh.prototype.raycast;
            hitbox.userData = { planetMesh: planet, name: config.name };
            hitboxes.push(hitbox);

            const position = getPlanetPosition(config, now);
            planet.position.set(position.x, 0, position.z);

            if (config.semiMajorAxis > 0) {
                const orbit = createOrbitEllipse(config);
                orbitLines.push(orbit);
                scene.add(orbit);
            }

            planet.geometry.computeBoundingSphere();
            planet.geometry.boundingSphere.radius *= 6;

            planet.userData = {
                ...config,
                inclination: config.inclination * Math.PI / 180,
                //trail: new PlanetTrail(config.color),
                initialTime: now
            };

            //scene.add(planet.userData.trail.line);
            scene.add(planetGroup);
            if (config.type === "comet") {
                //createCometTail(planet);
                createCometHalo(planet);
            }
            return planet;
        }).filter(p => p !== null);

        const earth = planets.find(p => p.userData.name === "Země");
        if (earth) {
            const moonRadius = 1.5;
            const moonDistance = 15;
            const moonSpeed = THREE.MathUtils.degToRad(13.177);
            const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
            const moonMaterial = new THREE.MeshPhongMaterial({
                map: textureLoader.load('textures/Moon_texture.jpg')
            });
            const moon = new THREE.Mesh(moonGeometry, moonMaterial);
            moon.userData = {
                name: "Měsíc",
                type: "moon",
                parent: earth,
                orbitRadius: moonDistance,
                speed: moonSpeed,
                initialAngle: 0,
                preview: 'textures/Moon.gif',
                info: `Měsíc je přirozený satelit Země. Obíhá ji ve vzdálenosti ~384 400 km. Oběžná doba: 27,3 dní.
                    <br><a href="https://cs.wikipedia.org/wiki/M%C4%9Bs%C3%ADc" target="_blank" style="color:#00ff9d;">Více na Wikipedii</a>`
            }
            scene.add(moon);
            planets.push(moon);
        }

        createAsteroidBeltInstanced();
        sun = planets.find(p => p.userData.type === "star");
        currentCameraTarget = sun;

        if (!planets.some(p => p.userData?.glbPath)) {
            createObjectList(planets);
        }
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            logarithmicDepthBuffer: true
        });
        renderer.setSize(solarSystemContainer.clientWidth, solarSystemContainer.clientHeight);
        renderer.setClearColor(0x000000);
        renderer.sortObjects = false;
        solarSystemContainer.appendChild(renderer.domElement);

        const onMouseDown = (event) => {
            isDragging = true;
            previousMousePosition = { x: event.clientX, y: event.clientY };
        };
        window.addEventListener('resize', () => {
            const container = document.getElementById('solar-system-container');
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
function getMouseRaycaster(event) {
            const canvas = renderer.domElement;
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
}
        const onMouseMove = (event) => {
            getMouseRaycaster(event);
            const intersects = raycaster.intersectObjects(planets, true);
            const validHover = intersects.find(hit => !hit.object.userData.ignoreClick);

            if (validHover) {
                hoveredObject = validHover.object;
                document.getElementById('hover-tooltip').style.display = 'block';
            } else {
                hoveredObject = null;
                document.getElementById('hover-tooltip').style.display = 'none';
            }

            if (!isDragging) return;
            const delta = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };

            cameraTheta += delta.x * cameraSpeed;
            cameraPhi -= delta.y * cameraSpeed * 0.5;
            cameraPhi = Math.max(0.1 * Math.PI, Math.min(0.9 * Math.PI, cameraPhi));

            previousMousePosition = { x: event.clientX, y: event.clientY };
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        const onWheel = (event) => {
            cameraRadius = Math.min(maxDistance, Math.max(minDistance, cameraRadius + event.deltaY * -0.1));
        };

        function onTouchStart(event) {
            if (event.touches.length === 1) {
                isDragging = true;
                previousMousePosition = {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };
            }
        }

        function getDistance(touch1, touch2) {
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function onTouchMove(event) {
            if (event.touches.length === 1 && isDragging) {
                const deltaMove = {
                    x: event.touches[0].clientX - previousMousePosition.x,
                    y: event.touches[0].clientY - previousMousePosition.y
                };

                cameraTheta += deltaMove.x * cameraSpeed;
                cameraPhi -= deltaMove.y * cameraSpeed;
                cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));

                previousMousePosition = {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };

                event.preventDefault();
            }

            if (event.touches.length === 2) {
                const distance = getDistance(event.touches[0], event.touches[1]);

                if (initialPinchDistance === null) {
                    initialPinchDistance = distance;
                    lastPinchZoom = cameraRadius;
                } else {
                    const zoomFactor = initialPinchDistance / distance;
                    cameraRadius = lastPinchZoom * zoomFactor;

                    // Omezíme rozsah zoomu
                    cameraRadius = Math.max(minDistance, Math.min(maxDistance, cameraRadius));
                }

                event.preventDefault();
            }
        }


        function onTouchEnd(event) {
            isDragging = false;
            if (event.touches.length < 2) {
                initialPinchDistance = null;
            }
        }
        solarSystemContainer.addEventListener('touchstart', onTouchStart, { passive: false });
        solarSystemContainer.addEventListener('touchmove', onTouchMove, { passive: false });
        solarSystemContainer.addEventListener('touchend', onTouchEnd);
        solarSystemContainer.addEventListener('mousedown', onMouseDown);
        solarSystemContainer.addEventListener('mouseup', onMouseUp);
        solarSystemContainer.addEventListener('mouseleave', onMouseUp);
        solarSystemContainer.addEventListener('mousemove', onMouseMove);
        solarSystemContainer.addEventListener('wheel', onWheel);
        solarSystemContainer.addEventListener('contextmenu', (e) => e.preventDefault());

        solarSystemContainer.addEventListener('click', (event) => {
            if (isDragging) return;
            getMouseRaycaster(event);
            //drawRaycasterRay(raycaster);
            scene.updateMatrixWorld(true);
            const clickableObjects = [sun, ...planets];
            const intersects = raycaster.intersectObjects(clickableObjects, true);

            const validHit = intersects.find(hit => !hit.object.userData.ignoreClick);
            if (validHit) {
                const clickedObject = validHit.object;
                const targetPlanet = clickedObject.userData?.planetMesh || clickedObject;

                if (targetPlanet.userData?.type !== 'moon') {
                    focusOnPlanet(targetPlanet);
                }
                //deaktivovaný infopanel při kliknutí na planetu
                //showPopupOnObject(targetPlanet);

                if (targetPlanet.userData?.type === 'star') {
                    cameraRadius = 300;
                }
            } else {
                popupTarget = null;
                //document.getElementById('popup-info').style.display = 'none';
                document.getElementById('info-panel').classList.add('hidden');
            }
        });
function updateSpeedDisplay() {
            const speedDisplay = document.getElementById('speed-display');
            if (speedDisplay) {
                speedDisplay.innerText = `Sim Speed: ${speedFactor.toFixed(0)}×`;
            }
        }
        document.getElementById('speed-up').addEventListener('click', () => {
            speedFactor = Math.min(100, speedFactor + 1);
            updateSpeedDisplay();
        });

        document.getElementById('speed-up10').addEventListener('click', () => {
            speedFactor = Math.min(100, speedFactor + 10);
            updateSpeedDisplay();
        });

        document.getElementById('slow-down').addEventListener('click', () => {
            speedFactor = Math.max(0.0, speedFactor - 1);
            updateSpeedDisplay();
        });

        document.getElementById('slow-down10').addEventListener('click', () => {
            speedFactor = Math.max(0.0, speedFactor - 10);
            updateSpeedDisplay();
        });

        document.getElementById('stop').addEventListener('click', () => {
            isRotationFrozen = true;
        });

        document.getElementById('start').addEventListener('click', () => {
            isRotationFrozen = false;
            if (lastTime === 0) lastTime = performance.now();
        });

        document.getElementById('reset-speed').addEventListener('click', () => {
            speedFactor = 1;
            updateSpeedDisplay();
        });

        document.getElementById('reload-page').addEventListener('click', () => {
            location.reload();
        });

        requestAnimationFrame((timestamp) => {
            lastTime = timestamp;
            animate(timestamp);
        });

    } catch (error) {
        console.error("Chyba:", error);
        alert("Aplikaci nelze spustit: " + error.message);
    }
}
function getScreenPosition(object3D, camera, renderer) {
    const worldPos = new THREE.Vector3();
    object3D.getWorldPosition(worldPos);
    const vector = worldPos.project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
        x: (vector.x * 0.5 + 0.5) * rect.width + rect.left,
        y: (-vector.y * 0.5 + 0.5) * rect.height + rect.top
    };
}
document.getElementById('toggle-side-panels').addEventListener('click', () => {
    const panel = document.getElementById('side-panels');
    const button = document.getElementById('toggle-side-panels');

    panel.classList.toggle('collapsed');
    button.textContent = panel.classList.contains('collapsed') ? '📁' : '📁';
});
function animate(timestamp) {
    requestAnimationFrame(animate);

    if (lastTime === 0) lastTime = timestamp;
    const deltaTime = (timestamp - lastTime) * 0.001;
    lastTime = timestamp;

    if (!isRotationFrozen) {
        simulatedTime += deltaTime * speedFactor;

        sun.rotation.y += 0.001 * speedFactor;

        planets.forEach(planet => {
            const data = planet.userData;
            const time = data.initialTime + simulatedTime;
            const position = getPlanetPosition(data, time);
            planet.position.set(position.x, 0, position.z);

            if (data.type === 'planet' || data.type === 'transneptunic'|| data.type === 'sun') {
                planet.rotation.y += 0.01 * speedFactor;
            }
            if (data.type === "comet" && planet.userData.tail) {
                const cometWorldPos = new THREE.Vector3();
                planet.getWorldPosition(cometWorldPos);
                const sunWorldPos = new THREE.Vector3();
                sun.getWorldPosition(sunWorldPos);
                const direction = new THREE.Vector3().subVectors(cometWorldPos, sunWorldPos).normalize();
                planet.userData.tail.material.rotation = Math.atan2(direction.x, direction.z);
            }
            if (data.type === "moon" && data.parent) {
                const parentPos = new THREE.Vector3();
                data.parent.getWorldPosition(parentPos);
                const angle = data.initialAngle + simulatedTime * data.speed;
                const x = parentPos.x + data.orbitRadius * Math.cos(angle);
                const z = parentPos.z + data.orbitRadius * Math.sin(angle);
                planet.position.set(x, 0, z);
            }
            //data.trail.update(planet.position);
        });
    }

    updateCameraPosition(currentCameraTarget);
    renderer.render(scene, camera);

    if (popupTarget) {
        const { x, y } = getScreenPosition(popupTarget, camera, renderer);
        const popup = document.getElementById("popup-info");
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
    }

    if (hoveredObject) {
        const { x, y } = getScreenPosition(hoveredObject, camera, renderer);
        const tooltip = document.getElementById("hover-tooltip");
        tooltip.innerText = hoveredObject.userData?.name || "Neznámý objekt";
        tooltip.style.left = `${x - 80}px`;
        tooltip.style.top = `${y - 40}px`;
    }
    if (highlightHalo && highlightedObject) {
        highlightedObject.getWorldPosition(highlightHalo.position);

        const pulseSpeed = 6;
        const scaleFactor = 1 + 0.6 * Math.sin(performance.now() * 0.001 * pulseSpeed);
        highlightHalo.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
}
document.getElementById('start-experience').addEventListener('click', () => {
    document.getElementById('intro-modal').style.display = 'none';
    initSolarSystem();
});
/*function drawRaycasterRay(raycaster) {
    const origin = raycaster.ray.origin;
    const direction = raycaster.ray.direction.clone().normalize().multiplyScalar(10000);

    const arrowHelper = new THREE.ArrowHelper(
        direction.clone().normalize(),
        origin,
        direction.length(),
        0xff0000
    );

    const oldArrow = scene.getObjectByName('rayHelper');
    if (oldArrow) scene.remove(oldArrow);
    arrowHelper.name = 'rayHelper';
    scene.add(arrowHelper);
}*/

function createObjectList(objects) {
    const container = document.getElementById('object-list');
    if (!container) return;

    container.innerHTML = `
        <div class="object-section">
            <button class="toggle-section" data-target="star-list">🪐 Hvězdy</button>
            <ul id="star-list" class="object-sublist"></ul>
        </div>
        <div class="object-section">
            <button class="toggle-section" data-target="planet-list">🪐 Planety</button>
            <ul id="planet-list" class="object-sublist"></ul>
        </div>
        <div class="object-section">
            <button class="toggle-section" data-target="transneptunic-list">🪐 Planetky</button>
            <ul id="transneptunic-list" class="object-sublist"></ul>
        </div>
        <div class="object-section">
            <button class="toggle-section" data-target="comet-list">☄️ Komety</button>
            <ul id="comet-list" class="object-sublist"></ul>
        </div>
        <div class="object-section">
            <button class="toggle-section" data-target="probe-list">🛰️ Sondy</button>
            <ul id="probe-list" class="object-sublist"></ul>
        </div>
        <div class="object-section">
            <button class="toggle-section" data-target="moon-list">🌕 Měsíce</button>
            <ul id="moon-list" class="object-sublist"></ul>
        </div>
    `;
    const starList = document.getElementById('star-list');
    const planetList = document.getElementById('planet-list');
    const transneptunicList = document.getElementById('transneptunic-list');
    const cometList = document.getElementById('comet-list');
    const probeList = document.getElementById('probe-list');
    const moonList = document.getElementById('moon-list');


    objects.forEach(obj => {
        const item = document.createElement('li');
        item.textContent = obj.userData.name;
        item.addEventListener('click', () => {
            focusOnPlanet(obj);
            showPopupOnObject(obj);
        });

        item.addEventListener('mouseenter', () => {
            setHighlightHalo(obj, true);
        });
        item.addEventListener('mouseleave', () => {
            setHighlightHalo(obj, false);
        });

        if (obj.userData.type === 'comet') {
            cometList.appendChild(item);
        }
        else if(obj.userData.type === 'transneptunic') {
            transneptunicList.appendChild(item);
        }
        else if(obj.userData.type === 'star') {
            starList.appendChild(item);
        }
        else if (obj.userData.type === 'probe') {
            probeList.appendChild(item);
        }
        else if (obj.userData.type === 'moon') {
            moonList.appendChild(item);
        }
        else {
            planetList.appendChild(item);
        }
    });

    document.querySelectorAll('.toggle-section').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const list = document.getElementById(targetId);
            const visible = list.style.display !== 'none';
            list.style.display = visible ? 'none' : 'block';
        });
    });
    document.getElementById('star-list').style.display = 'none';
    document.getElementById('planet-list').style.display = 'none';
    document.getElementById('transneptunic-list').style.display = 'none';
    document.getElementById('comet-list').style.display = 'none';
    document.getElementById('probe-list').style.display = 'none';
    document.getElementById('moon-list').style.display = 'none';
}

function setHighlightHalo(object, show = true) {
    if (!highlightEnabled || !object || object.userData.type === "star") return;

    if (show) {
        if (highlightHalo) scene.remove(highlightHalo);

        const geometry = new THREE.SphereGeometry(object.geometry.parameters.radius * 6, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFF1493,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        });

        highlightHalo = new THREE.Mesh(geometry, material);
        scene.add(highlightHalo);

        highlightedObject = object;
    } else {
        if (highlightHalo) {
            scene.remove(highlightHalo);
            highlightHalo = null;
        }
        highlightedObject = null;
    }
}

function showPopupOnObject(object) {
    //const popup = document.getElementById("popup-info");
    const name = object.userData?.name || "Neznámý objekt";
    const info = object.userData?.info || "";
    const preview = object.userData?.preview;
    const infoPanel = document.getElementById("info-panel");
    const imageEl = document.getElementById("info-image");
    const textEl = document.getElementById("info-text");

    infoPanel.querySelector(".popup-title").innerText = `🪐 ${name}`;
    imageEl.src = preview;
    imageEl.alt = name;
    textEl.innerHTML = info;

    infoPanel.classList.remove("hidden");
    popupTarget = object;
    /*popup.innerHTML = `
        <div class="popup-title">🪐 ${name}</div>
        ${preview ? `<img src="${preview}" alt="${name}" width="150" height="150" style="margin: 5px 0; object-fit: cover; border-radius: 8px;" />` : ""}
        <div class="popup-info-text">${info}</div>
    `;
    popup.style.display = "block";*/
}

document.getElementById('toggle-highlight').addEventListener('click', () => {
    highlightEnabled = !highlightEnabled;
    document.getElementById('toggle-highlight').textContent =
        `✨ Zvýraznění objektů: ${highlightEnabled ? "Zapnuto" : "Vypnuto"}`;
    if (!highlightEnabled && highlightHalo) {
        scene.remove(highlightHalo);
        highlightHalo = null;
    }
});
document.getElementById('toggle-orbits').addEventListener('click', () => {
    orbitsVisible = !orbitsVisible;
    orbitLines.forEach(orbit => {
        orbit.visible = orbitsVisible;
    });
    document.getElementById('toggle-orbits').textContent =
        `✨ Orbitální čáry: ${orbitsVisible ? "Zapnuto" : "Vypnuto"}`;
});

/*function createCometTail(comet) {
    const tailTexture = new THREE.TextureLoader().load('textures/comet_tail_texture2.png');
    const tailMaterial = new THREE.SpriteMaterial({
        map: tailTexture,
        color: 0xccccff,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
    });
    const tail = new THREE.Sprite(tailMaterial);
    const width = comet.userData.radius * 10;
    const height = comet.userData.radius * 35;
    tail.scale.set(width, height, 1);
    tail.center.set(0.5, 0);
    tail.userData.ignoreClick = true;
    comet.add(tail);
    comet.userData.tail = tail;
}*/

function createCometHalo(comet) {
    const texture = new THREE.TextureLoader().load('textures/fuzzyHalo.png');
    const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0xaaaaee,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const halo = new THREE.Sprite(material);
    const scale = comet.userData.radius * 12;
    halo.scale.set(scale, scale, 1);
    halo.center.set(0.5, 0.5);
    halo.userData.ignoreClick = true;
    comet.add(halo);
    comet.userData.halo = halo;
}

const music = document.getElementById('background-music');
const toggleBtn = document.getElementById('toggle-music');
const volumeSlider = document.getElementById('volume-slider');

window.addEventListener('click', () => {
    if (music.paused) {
        music.play().catch(() => {});
    }
}, { once: true });

toggleBtn.addEventListener('click', () => {
    if (music.muted) {
        music.muted = false;
        toggleBtn.classList.remove('muted');
        toggleBtn.textContent = '🎵';
    } else {
        music.muted = true;
        toggleBtn.classList.add('muted');
        toggleBtn.textContent = '🔇';
    }
});

volumeSlider.addEventListener('input', () => {
    music.volume = volumeSlider.value;
    if (music.volume === 0) {
        toggleBtn.classList.add('muted');
        toggleBtn.textContent = '🔇';
    } else {
        music.muted = false;
        toggleBtn.classList.remove('muted');
        toggleBtn.textContent = '🎵';
    }
});