//planety začínají na pozicich jako v reálu
//pri najetí na planetu - text + v textu odkazy
// zvuky vesmíru
// video při najeti na planetu - animace - realná
// přepínání realscale/teachingscale

import * as THREE from 'three';

let scene, camera, renderer, sun;
let solarSystemContainer;
let currentCameraTarget;
let background;
let planets = [];
let speedFactor = 1;
let lastTime = 0;
let simulatedTime = 0;
let isAnimating = true;

// Ovládací proměnné
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraRadius = 300;
const minDistance = 50;
const maxDistance = 1500;
const cameraSpeed = 0.005;
let cameraTheta = 0;
let cameraPhi = Math.PI / 2;
const lerpFactor = 0.1; // Koeficient pro plynulý pohyb

class PlanetTrail {
    constructor(color) {
        this.points = [];
        this.trailLength = 500;
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
    
    // Lineární interpolace pro plynulý pohyb
    camera.position.lerp(desiredPosition, lerpFactor);
    camera.lookAt(targetPosition);
}

function focusOnPlanet(planetMesh) {
    currentCameraTarget = planetMesh;
    cameraRadius = planetMesh.userData.radius * 10;
    cameraTheta = 0;
    cameraPhi = Math.PI / 2;
}

function initSolarSystem() {
    try {
        solarSystemContainer = document.getElementById("solar-system-container");
        
        // Reset scény
        scene = new THREE.Scene();
        const textureLoader = new THREE.TextureLoader();

        // pozadi
        const backgroundGeometry = new THREE.SphereGeometry(3000, 64, 64);
        const backgroundMaterial = new THREE.MeshBasicMaterial({
            map: textureLoader.load('textures/2k_stars_milky_way.jpg'),
            side: THREE.BackSide,
            depthWrite: false,
            transparent: true,
            opacity: 1
        });
        background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        background.userData.isBackground = true;
        scene.add(background);

        // Kamera
        camera = new THREE.PerspectiveCamera(
            75,
            solarSystemContainer.clientWidth / solarSystemContainer.clientHeight,
            0.1,
            5000
        );

        // Slunce
        sun = new THREE.Mesh(
            new THREE.SphereGeometry(22, 32, 32),
            new THREE.MeshPhongMaterial({
                map: textureLoader.load('textures/2k_sun.jpg'),
                emissive: 0xffffee,
                emissiveIntensity: 0.5
            })
        );
        scene.add(sun);
        currentCameraTarget = sun;

        // Planety
        const planetsConfig = [
            { name: "Merkur", radius: 3.5, semiMajorAxis: 58, eccentricity: 0.2056, inclination: 7.0, speed: 0.0479, texture: 'textures/2k_mercury.jpg', color: 0x808080 },
            { name: "Venuše", radius: 6.8, semiMajorAxis: 108, eccentricity: 0.0068, inclination: 3.39, speed: 0.0350, texture: 'textures/2k_venus_surface.jpg', color: 0xffd700 },
            { name: "Země", radius: 7, semiMajorAxis: 150, eccentricity: 0.0167, inclination: 0.00005, speed: 0.01, texture: 'textures/2k_earth_daymap.jpg', color: 0x0000ff },
            { name: "Mars", radius: 5.5, semiMajorAxis: 228, eccentricity: 0.0934, inclination: 1.85, speed: 0.008, texture: 'textures/2k_mars.jpg', color: 0xff0000 },
            { name: "Jupiter", radius: 11, semiMajorAxis: 300, eccentricity: 0.0489, inclination: 1.304, speed: 0.005, texture: 'textures/2k_jupiter.jpg', color: 0xffa500 },
            { name: "Saturn", radius: 10, semiMajorAxis: 500, eccentricity: 0.0565, inclination: 2.485, speed: 0.004, texture: 'textures/2k_saturn.jpg', color: 0xffd700 },
            { name: "Uran", radius: 9, semiMajorAxis: 700, eccentricity: 0.0463, inclination: 0.772, speed: 0.003, texture: 'textures/2k_uranus.jpg', color: 0x00ffff },
            { name: "Neptun", radius: 8.5, semiMajorAxis: 900, eccentricity: 0.0095, inclination: 1.769, speed: 0.002, texture: 'textures/2k_neptune.jpg', color: 0x0000cd }
        ];

        planets = planetsConfig.map(config => {
            const planet = new THREE.Mesh(
                new THREE.SphereGeometry(config.radius, 32, 32),
                new THREE.MeshPhongMaterial({
                    map: textureLoader.load(config.texture),
                    specular: 0x111111,
                    shininess: 5
                })
            );
            
            planet.userData = {
                ...config,
                inclination: config.inclination * Math.PI/180,
                trail: new PlanetTrail(config.color)
            };
            
            scene.add(planet.userData.trail.line);
            scene.add(planet);
            return planet;
        });

        // Osvětlení
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(solarSystemContainer.clientWidth, solarSystemContainer.clientHeight);
        renderer.setClearColor(0x000000);
        solarSystemContainer.appendChild(renderer.domElement);

        // Ovládání myší
        solarSystemContainer.addEventListener('click', (event) => {
            const rect = solarSystemContainer.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            const clickableObjects = [sun, ...planets];
            const intersects = raycaster.intersectObjects(clickableObjects, false);
            
            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                focusOnPlanet(clickedObject);
                if (clickedObject === sun) cameraRadius = 300;
            }
        });

        const onMouseDown = (event) => {
            isDragging = true;
            previousMousePosition = { x: event.clientX, y: event.clientY };
        };

        const onMouseMove = (event) => {
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

        const onWheel = (event) => {
            cameraRadius = Math.min(maxDistance, Math.max(minDistance, cameraRadius + event.deltaY * -0.1));
        };

        solarSystemContainer.addEventListener('mousedown', onMouseDown);
        solarSystemContainer.addEventListener('mouseup', () => isDragging = false);
        solarSystemContainer.addEventListener('mouseleave', () => isDragging = false);
        solarSystemContainer.addEventListener('mousemove', onMouseMove);
        solarSystemContainer.addEventListener('wheel', onWheel);
        solarSystemContainer.addEventListener('contextmenu', (e) => e.preventDefault());

        

        requestAnimationFrame((timestamp) => {
            lastTime = timestamp; // Inicializace časové základny
            animate(timestamp);
        });

    } catch (error) {
        console.error("Chyba:", error);
        alert("Aplikaci nelze spustit: " + error.message);
    }
        //tlacitka ovladani rychlosti rotaci
    document.getElementById('speed-up').addEventListener('click', () => {
        speedFactor = Math.min(8, speedFactor * 2);
    });

    document.getElementById('slow-down').addEventListener('click', () => {
        speedFactor = Math.max(0.125, speedFactor * 0.5);
    });

    document.getElementById('stop').addEventListener('click', () => {
        isAnimating = false;
    });

    document.getElementById('start').addEventListener('click', () => {
        if (!isAnimating) {
            isAnimating = true;
            lastTime = performance.now();
            requestAnimationFrame(animate);
        }
    });
}

// Animace
function animate(timestamp) {
    requestAnimationFrame(animate);
    if (!isAnimating) return;
    //první iterace času
    if (lastTime === 0) lastTime = timestamp;
    //Vypocet deltaTime
    const deltaTime = (timestamp - lastTime) * 0.001;
    lastTime = timestamp;

    //aktualizace simulovaneho casu
    simulatedTime += deltaTime * speedFactor;
    
    // Rotace Slunce
    sun.rotation.y += 0.001 * speedFactor;

    // Pohyb planet
    planets.forEach(planet => {
        const data = planet.userData;
        const angle = simulatedTime * data.speed;
        const r = data.semiMajorAxis * (1 - data.eccentricity**2) / (1 + data.eccentricity * Math.cos(angle));
        
        if (isNaN(r)) {
            console.error("NaN hodnota u planety:", data.name);
            return;
        }

        planet.position.set(
            r * Math.cos(angle),
            Math.sin(angle) * Math.sin(data.inclination) * r,
            r * Math.sin(angle)
        );
        planet.rotation.y += 0.01 * speedFactor;
        data.trail.update(planet.position);
        planet.geometry.computeBoundingSphere();
        planet.geometry.boundingSphere.radius *= 2;
    });

    // Aktualizace kamery
    updateCameraPosition(currentCameraTarget.position);
    renderer.render(scene, camera);
}

// Spuštění
document.getElementById("solar-system-link").addEventListener("click", (e) => {
    e.preventDefault();
    const container = document.getElementById("solar-system-container");
    if (container && !container.querySelector('canvas')) initSolarSystem();
});