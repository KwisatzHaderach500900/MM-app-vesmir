import * as THREE from 'three';

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

class PlanetTrail {
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
}

function updateCameraPosition(targetPosition) {
    const desiredPosition = new THREE.Vector3(
        targetPosition.x + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta),
        targetPosition.y + cameraRadius * Math.cos(cameraPhi),
        targetPosition.z + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta)
    );

    camera.position.lerp(desiredPosition, lerpFactor);
    camera.lookAt(targetPosition);
}

function focusOnPlanet(planetMesh) {
    currentCameraTarget = planetMesh;
    currentCameraPosition.copy(camera.position);

    if (planetMesh === sun) {
        cameraRadius = 300;
        //cameraTheta = Math.PI / 4;
        //cameraPhi = Math.PI / 2.5;
    } else {
        cameraRadius = planetMesh.userData.radius * 15;
        //cameraTheta = 0;
        //cameraPhi = Math.PI / 2;
    }
    cameraRadius = Math.max(minDistance, cameraRadius);
    updateCameraPosition(planetMesh.position);
}

function getPlanetPosition(config, time) {
    const angle = time * config.speed;
    const r = config.semiMajorAxis * (1 - config.eccentricity ** 2) / (1 + config.eccentricity * Math.cos(angle));

    return new THREE.Vector3(
        r * Math.cos(angle),
        Math.sin(angle) * Math.sin(config.inclination * Math.PI / 180) * r,
        r * Math.sin(angle)
    );
}

function initSolarSystem() {
    try {
        solarSystemContainer = document.getElementById("solar-system-container");

        scene = new THREE.Scene();
        const textureLoader = new THREE.TextureLoader();

        const backgroundGeometry = new THREE.SphereGeometry(6500, 64, 64);
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
            75,
            solarSystemContainer.clientWidth / solarSystemContainer.clientHeight,
            0.1,
            100000
        );

        sun = new THREE.Mesh(
            new THREE.SphereGeometry(22, 32, 32),
            new THREE.MeshPhongMaterial({
                map: textureLoader.load('textures/2k_sun.jpg'),
                emissive: 0xffffee,
                emissiveIntensity: 0.1
            })
        );
        sun.userData = { name: 'Slunce',
        info: "Tak asi Slunce ne? Hvězda kámo, prostě jedinej a pravej bůh všech opic z planety Země."
        };
        scene.add(sun);
        currentCameraTarget = sun;

        const planetsConfig = [
            { name: "Merkur",
                radius: 3.5,
                semiMajorAxis: 58,
                eccentricity: 0.2056,
                inclination: 7.0,
                speed: 0.0479,
                texture: 'textures/2k_mercury.jpg',
                color: 0x808080,
                type: "planet",
                info: "První planeta Sluneční soustavy. Vzdálenost od Slunce: 58 milionů km. Délka dne a noci: 59 dní. Povrchový tlak: téměř nulový, teplota: −180 °C až +430 °C. Vychýlení oběžné dráhy: 0,206. Oběžná rychlost: 47,9 km/s."
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
                info: "Druhá planeta Sluneční soustavy. Vzdálenost od Slunce: 108 milionů km. Délka dne a noci: 243 dní (retrográdní rotace). Povrchový tlak: ~92x vyšší než Země, teplota: ~465 °C. Vychýlení oběžné dráhy: 0,007. Oběžná rychlost: 35,0 km/s."
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
                info: "Třetí planeta Sluneční soustavy. Vzdálenost od Slunce: 150 milionů km. Délka dne a noci: 24 hodin. Povrchový tlak: 101,3 kPa, teplota: −88 °C až +58 °C. Vychýlení oběžné dráhy: 0,017. Oběžná rychlost: 29,8 km/s."
            },
            { name: "Mars",
                radius: 5.5,
                semiMajorAxis: 228,
                eccentricity: 0.0934,
                inclination: 1.85,
                speed: 0.008,
                texture: 'textures/2k_mars.jpg',
                color: 0xff0000,
                info: "Čtvrtá planeta Sluneční soustavy. Vzdálenost od Slunce: 228 milionů km. Délka dne a noci: 24,6 hodiny. Povrchový tlak: ~0,6 kPa, teplota: −125 °C až +20 °C. Vychýlení oběžné dráhy: 0,093. Oběžná rychlost: 24,1 km/s."
            },
            { name: "Jupiter",
                radius: 11,
                semiMajorAxis: 300,
                eccentricity: 0.0489,
                inclination: 1.304,
                speed: 0.005,
                texture: 'textures/2k_jupiter.jpg',
                color: 0xffa500,
                type: "planet",
                info: "Pátá a největší planeta Sluneční soustavy. Vzdálenost od Slunce: 778 milionů km. Délka dne a noci: 9,9 hodin. Povrchový tlak: velmi vysoký (plynný obor), teplota: ~−145 °C. Vychýlení oběžné dráhy: 0,049. Oběžná rychlost: 13,1 km/s."
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
                info: "Šestá planeta Sluneční soustavy. Vzdálenost od Slunce: 1,43 miliardy km. Délka dne a noci: 10,7 hodin. Povrchový tlak: vysoký, teplota: ~−178 °C. Vychýlení oběžné dráhy: 0,057. Oběžná rychlost: 9,7 km/s."
            },
            { name: "Uran",
                radius: 9,
                semiMajorAxis: 700,
                eccentricity: 0.0463,
                inclination: 0.772,
                speed: 0.003,
                texture: 'textures/2k_uranus.jpg',
                color: 0x00ffff,
                info: "Sedmá planeta Sluneční soustavy. Vzdálenost od Slunce: 2,87 miliardy km. Délka dne a noci: 17,2 hodin. Povrchový tlak: nejasný, teplota: ~−224 °C. Vychýlení oběžné dráhy: 0,046. Oběžná rychlost: 6,8 km/s."
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
                info: "Osmá planeta Sluneční soustavy. Vzdálenost od Slunce: 4,5 miliardy km. Délka dne a noci: 16 hodin. Povrchový tlak: neznámý, teplota: ~−218 °C. Vychýlení oběžné dráhy: 0,010. Oběžná rychlost: 5,4 km/s."
            },
            {
                name: "Pluto",
                radius: 3,
                semiMajorAxis: 1200,
                eccentricity: 0.2488,
                inclination: 17.16,
                speed: 0.00039,
                texture: 'textures/pluto.jpg',
                color: 0xbfbfbf,
                type: "transneptunic",
                info: "Trpasličí planeta ve vnější části Sluneční soustavy. Vzdálenost od Slunce: 5,9 miliardy km. Délka dne a noci: 6,4 dne. Povrchový tlak: ~1 Pa, teplota: −229 °C. Vychýlení oběžné dráhy: 0,249. Oběžná rychlost: 4,7 km/s."
            },
            {
                name: "Ceres",
                radius: 2.5,
                semiMajorAxis: 414,
                eccentricity: 0.0758,
                inclination: 10.6,
                speed: 0.0027,
                texture: 'textures/ceres.jpg',
                color: 0x999999,
                type: "transneptunic",
                info: "Trpasličí planeta a největší objekt hlavního pásu asteroidů. Vzdálenost od Slunce: 414 milionů km. Délka dne a noci: 9 hodin. Povrchový tlak: velmi nízký, teplota: −105 °C. Vychýlení oběžné dráhy: 0,076. Oběžná rychlost: 17,9 km/s."
            },
            {
                name: "Haumea",
                radius: 4,
                semiMajorAxis: 1800,
                eccentricity: 0.188,
                inclination: 28.2,
                speed: 0.00029,
                texture: 'textures/haumea.jpg',
                color: 0xddddff,
                info: "Trpasličí planeta s protáhlým tvarem. Vzdálenost od Slunce: 6,4 miliardy km. Délka dne a noci: 3,9 hodiny (nejrychlejší rotace). Povrchový tlak: žádný, teplota: −241 °C. Vychýlení oběžné dráhy: 0,188. Oběžná rychlost: 4,5 km/s."
            },
            {
                name: "Makemake",
                radius: 3.5,
                semiMajorAxis: 2000,
                eccentricity: 0.159,
                inclination: 28.96,
                speed: 0.00026,
                texture: 'textures/makemake.jpg',
                color: 0xffcccc,
                type: "transneptunic",
                info: "Trpasličí planeta v Kuiperově pásu. Vzdálenost od Slunce: 6,85 miliardy km. Délka dne a noci: ~7,8 hodiny. Povrchový tlak: téměř nulový, teplota: ~−239 °C. Vychýlení oběžné dráhy: 0,159. Oběžná rychlost: 4,4 km/s."
            },
            {
                name: "Eris",
                radius: 3.4,
                semiMajorAxis: 4000,
                eccentricity: 0.44,
                inclination: 44.0,
                speed: 0.00016,
                texture: 'textures/eris.jpg',
                color: 0xe0e0e0,
                type: "transneptunic",
                info: "Jedna z největších trpasličích planet. Vzdálenost od Slunce: 10,1 miliardy km. Délka dne a noci: ~25,9 hodiny. Povrchový tlak: žádný, teplota: −231 °C. Vychýlení oběžné dráhy: 0,44. Oběžná rychlost: 3,4 km/s."
            },
            {
                name: "Halleyova kometa",
                radius: 2,
                semiMajorAxis: 2600, // 2,6 miliardy km
                eccentricity: 0.967,
                inclination: 162.26, // retrográdní (sklon > 90°)
                speed: 0.00075,
                texture: 'textures/comet_halley.jpg', // nebo 'textures/comet.jpg'
                color: 0xffffff,
                type: "comet",
                info: "Nejslavnější periodická kometa. Oběh kolem Slunce: 75 let. Vzdálenost od Slunce: 0,6–35 AU. Teplota: ~−70 °C až −220 °C. Vychýlení oběžné dráhy: 0,967. Retrográdní oběžná rychlost: ~54 km/s v perihéliu."
            },
            {
                name: "Hale-Boppova kometa",
                radius: 3,
                semiMajorAxis: 18600,
                eccentricity: 0.9951,
                inclination: 89.4,
                speed: 0.00009,
                texture: 'textures/comet_hale_bopp.jpg',
                color: 0xccffff,
                type: "comet",
                info: "Jasná a výrazná kometa viditelná v roce 1997. Vzdálenost od Slunce: až 370 AU. Délka oběhu: ~2533 let. Vychýlení oběžné dráhy: 0,995. Teplota: ~−200 °C. Rychlost u Slunce: až 45 km/s."
            },
            {
                name: "Enckeova kometa",
                radius: 1.5,
                semiMajorAxis: 388,
                eccentricity: 0.85,
                inclination: 11.8,
                speed: 0.0045,
                texture: 'textures/comet_encke.jpg',
                color: 0xdddddd,
                type: "comet",
                info: "Kometa s nejkratší známou periodou (~3,3 roku). Vzdálenost od Slunce: 0,34–4,1 AU. Teplota: až 300 °C v perihéliu. Vychýlení oběžné dráhy: 0,85. Rychlost: až 70 km/s."
            },
            {
                name: "Kohoutkova kometa",
                radius: 2.5,
                semiMajorAxis: 640,
                eccentricity: 0.999,
                inclination: 13.3,
                speed: 0.00095,
                texture: 'textures/comet_kohoutek.jpg',
                color: 0xddddff,
                type: "comet",
                info: "Slavná kometa pozorovaná v roce 1973. Velmi výstřední dráha (téměř parabolická). Oběžná doba: ~75 000 let. Vzdálenost od Slunce: až 350 AU. Vychýlení dráhy: 0,999."
            }
        ];

        const now = Date.now() / 1000;
        planets = planetsConfig.map((config) => {
            const planet = new THREE.Mesh(
                new THREE.SphereGeometry(config.radius, 32, 32),
                new THREE.MeshPhongMaterial({
                    map: textureLoader.load(config.texture),
                    specular: 0x111111,
                    shininess: 5
                })
            );

            const hitbox = new THREE.Mesh(
                new THREE.SphereGeometry(config.radius * 3.5, 32, 32),
                new THREE.MeshBasicMaterial({ visible: true, color: 0xff00ff, wireframe: true})
            );
            hitbox.geometry.computeBoundingSphere();
            hitbox.raycast = THREE.Mesh.prototype.raycast;
            hitbox.userData = { planetMesh: planet, name: config.name };
            hitboxes.push(hitbox);
            //planet.add(hitbox);

            const position = getPlanetPosition(config, now);
            planet.position.copy(position);
            planet.geometry.computeBoundingSphere();
            planet.geometry.boundingSphere.radius *= 6;

            planet.userData = {
                ...config,
                inclination: config.inclination * Math.PI / 180,
                trail: new PlanetTrail(config.color),
                initialTime: now
            };

            scene.add(planet.userData.trail.line);
            scene.add(planet);
            return planet;
        });
        createObjectList(planets);
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
function getMouseRaycaster(event) {
            const canvas = renderer.domElement;
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
}
        const onMouseMove = (event) => {
            getMouseRaycaster(event);
            const intersects = raycaster.intersectObjects([sun, ...planets], true);
            if (intersects.length > 0) {
                hoveredObject = intersects[0].object;
                document.getElementById('hover-tooltip').style.display = 'block';
            } else {
                hoveredObject = null;
                document.getElementById('hover-tooltip').style.display = 'none';
            }

            // Ovládání kamery (otáčení)
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
            console.log("Mouse position:", mouse);
            scene.updateMatrixWorld(true);
            const clickableObjects = [sun, ...planets];
            const intersects = raycaster.intersectObjects(clickableObjects, true);
            console.log("Intersections found:", intersects);

            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                const targetPlanet = clickedObject.userData?.planetMesh || clickedObject;
                console.log("Clicked on:", clickedObject.userData?.name || "Sun");
                focusOnPlanet(targetPlanet);
                showPopupOnObject(targetPlanet);
                if (targetPlanet === sun) {
                    cameraRadius = 300;
                }
            } else {
                console.log("No object clicked");
                popupTarget = null;
                const popup = document.getElementById('popup-info');
                popup.style.display = 'none';
            }
        });
function updateSpeedDisplay() {
            const speedDisplay = document.getElementById('speed-display');
            if (speedDisplay) {
                speedDisplay.innerText = `🔄 Rychlost: ${speedFactor.toFixed(0)}×`;
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
    const vector = object3D.position.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
        x: (vector.x * 0.5 + 0.5) * rect.width + rect.left,
        y: (-vector.y * 0.5 + 0.5) * rect.height + rect.top
    };
}

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
            planet.position.copy(position);
            planet.rotation.y += 0.01 * speedFactor;
            data.trail.update(planet.position);
        });
    }

    updateCameraPosition(currentCameraTarget.position);
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
    if (highlightHalo && popupTarget) {
        highlightHalo.position.copy(popupTarget.position);
    }
}
initSolarSystem();
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
            <button class="toggle-section" data-target="planet-list">🪐 Planety</button>
            <ul id="planet-list" class="object-sublist"></ul>
        </div>
        <div class="object-section">
            <button class="toggle-section" data-target="comet-list">☄️ Komety</button>
            <ul id="comet-list" class="object-sublist"></ul>
        </div>
    `;

    const planetList = document.getElementById('planet-list');
    const cometList = document.getElementById('comet-list');

    const sunItem = document.createElement('li');
    sunItem.textContent = sun.userData.name || "Slunce";
    sunItem.addEventListener('click', () => {
        focusOnPlanet(sun);
        showPopupOnObject(sun);
    });
    planetList.appendChild(sunItem);

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
        } else {
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
}

function setHighlightHalo(object, show = true) {
    if (!object || object === sun) return;

    if (show) {
        if (highlightHalo) scene.remove(highlightHalo);

        const geometry = new THREE.SphereGeometry(object.geometry.parameters.radius * 6, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        });

        highlightHalo = new THREE.Mesh(geometry, material);
        highlightHalo.position.copy(object.position);
        scene.add(highlightHalo);
    } else {
        if (highlightHalo) {
            scene.remove(highlightHalo);
            highlightHalo = null;
        }
    }
}

document.getElementById('toggle-object-list').addEventListener('click', () => {
    const list = document.getElementById('object-list');
    const button = document.getElementById('toggle-object-list');
    const visible = list.style.display !== 'none';

    list.style.display = visible ? 'none' : 'block';
    button.textContent = visible ? '🪐 Zobrazit planety' : '🪐 Skrýt planety';
});


function showPopupOnObject(object) {
    const popup = document.getElementById("popup-info");
    const name = object.userData?.name || "Neznámý objekt";
    const info = object.userData?.info || "";

    popup.innerHTML = `
        <div class="popup-title">🪐 ${name}</div>
        <div class="popup-info-text">${info}</div>
    `;
    popup.style.display = "block";
    popupTarget = object;
}