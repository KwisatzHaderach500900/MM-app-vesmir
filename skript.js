import * as THREE from 'three';

let scene, camera, renderer;
let solarSystemContainer;

// Vytvořte globální loader pro textury
const textureLoader = new THREE.TextureLoader();

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraDistance = 300;
const minDistance = 50;
const maxDistance = 1500;
const cameraSpeed = 0.005;
// Inicializujte kamera parametry
let cameraTheta = 0; // horizontální úhel
let cameraPhi = Math.PI / 2; // vertikální úhel (90° = shora)
let cameraRadius = 300; // počáteční vzdálenost

function updateCameraPosition() {
    // Přepočítej pozici kamery ze sférických souřadnic
    const x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    const y = cameraRadius * Math.cos(cameraPhi);
    const z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    
    camera.position.set(x, y, z);
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // Střed = Slunce
}

class PlanetTrail {
    constructor(color) {
        this.points = [];
        this.trailLength = 500;
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.LineBasicMaterial({ color: color, linewidth: 1 });
        this.line = new THREE.Line(this.geometry, this.material);
    }

    update(position) {
        // Přidání nové pozice
        this.points.push(position.clone());
        if (this.points.length > this.trailLength) {
            this.points.shift();
        }
        
        // Aktualizace geometrie
        this.geometry.setFromPoints(this.points);
        this.geometry.verticesNeedUpdate = true;
    }
}

function initSolarSystem() {
    try {
        const solarSystemContainer = document.getElementById("solar-system-container");
        
        // Scéna
        scene = new THREE.Scene();

        // Kamera
        camera = new THREE.PerspectiveCamera(
            75,
            solarSystemContainer.clientWidth / solarSystemContainer.clientHeight,
            0.1,
            5000
        );
        updateCameraPosition();
        camera.lookAt(new THREE.Vector3(0,0,0));

        // Ovládání myší
        const onMouseDown = (event) => {
            isDragging = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        const onMouseMove = (event) => {
            if (!isDragging) return;

            const delta = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };

            // Rotace kamery
            cameraTheta -= delta.x * cameraSpeed;
            cameraPhi -= delta.y * cameraSpeed * 0.5;
            
            // Omezení vertikálního úhlu (0.1π až 0.9π)
            cameraPhi = Math.max(0.1 * Math.PI, Math.min(0.9 * Math.PI, cameraPhi));
            
            updateCameraPosition();
            previousMousePosition = { x: event.clientX, y: event.clientY };
        };

        const onWheel = (event) => {
            // Zoom kolečkem myši
            cameraRadius += event.deltaY * -0.1;
            cameraRadius = Math.min(maxDistance, Math.max(minDistance, cameraRadius));
            updateCameraPosition();
        };

        solarSystemContainer.addEventListener('mousedown', onMouseDown);
        solarSystemContainer.addEventListener('mouseup', onMouseUp);
        solarSystemContainer.addEventListener('mouseleave', onMouseUp);
        solarSystemContainer.addEventListener('mousemove', onMouseMove);
        solarSystemContainer.addEventListener('wheel', onWheel);
        solarSystemContainer.addEventListener('contextmenu', (e) => e.preventDefault());

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(solarSystemContainer.clientWidth, solarSystemContainer.clientHeight);
        renderer.setClearColor(0x000000);
        solarSystemContainer.appendChild(renderer.domElement);

        // Osvětlení
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Slunce
        const sunTexture = textureLoader.load('textures/2k_sun.jpg');
        const sunGeometry = new THREE.SphereGeometry(22, 32, 32);
        const sunMaterial = new THREE.MeshPhongMaterial({
            map: sunTexture,
            emissive: 0xffffee,    // Světélkující efekt
            emissiveIntensity: 0.01 // Intenzita "záře"
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(sun);

        // Planety
        const planets = [
            {   name: "Merkur", 
                radius: 3.5, 
                semiMajorAxis: 58, 
                eccentricity: 0.2056, 
                inclination: 7.0 * Math.PI/180,
                speed: 0.0479,
                texture: 'textures/2k_mercury.jpg',
                color: 0x999999
            },
            {   name: "Venuše", 
                radius: 6.8, 
                semiMajorAxis: 108, 
                eccentricity: 0.0068, 
                inclination: 3.39 * Math.PI/180,
                speed: 0.0350,
                texture: 'textures/2k_venus_surface.jpg',
                color: 0x999999
            },
            {   name: "Země", 
                radius: 7, 
                semiMajorAxis: 150,
                eccentricity: 0.0167,
                inclination: 0.00005 * Math.PI/180,      
                speed: 0.01, 
                texture: 'textures/2k_earth_daymap.jpg',
                color: 0x999999
            },
            {   name: "Mars", 
                radius: 5.5, 
                semiMajorAxis: 228,
                eccentricity: 0.0934,
                inclination: 1.85 * Math.PI/180, 
                speed: 0.008, 
                texture: 'textures/2k_mars.jpg',
                color: 0x999999
            },
            {   name: "Jupiter", 
                radius: 11, 
                semiMajorAxis: 300,
                eccentricity: 0.0489,
                inclination: 1.304 * Math.PI/180, 
                speed: 0.005, 
                texture: 'textures/2k_jupiter.jpg',
                color: 0x999999
            },
            {   name: "Saturn", 
                radius: 10, 
                semiMajorAxis: 500,
                eccentricity: 0.0565,
                inclination: 2.485 * Math.PI/180,  
                speed: 0.004, 
                texture: 'textures/2k_saturn.jpg',
                color: 0x999999
            },
            {   name: "Uran", 
                radius: 9, 
                semiMajorAxis: 700,
                eccentricity: 0.0463,
                inclination: 0.772 * Math.PI/180, 
                speed: 0.003, 
                texture: 'textures/2k_uranus.jpg',
                color: 0x999999
            },
            {   name: "Neptun", 
                radius: 8.5, 
                semiMajorAxis: 900,
                eccentricity: 0.0095,
                inclination: 1.769 * Math.PI/180, 
                speed: 0.002,
                texture: 'textures/2k_neptune.jpg',
                color: 0x999999
            }
        ];

        planets.forEach(planet => {
            // Načtení textury pro všechny planety
            const texture = textureLoader.load(planet.texture);
            
            // Vytvoření materiálu s texturou
            const material = new THREE.MeshPhongMaterial({ 
                map: texture,
                specular: 0x111111,
                shininess: 5
            });
        
            // Vytvoření 3D objektu
            const geometry = new THREE.SphereGeometry(planet.radius, 32, 32);
            const mesh = new THREE.Mesh(geometry, material);
            
            // Pozicování a uložení dat
            mesh.position.x = planet.distance;
            mesh.userData = planet;
            scene.add(mesh);

            // Inicializace stopy
            mesh.userData.trail = new PlanetTrail(planet.color);
            scene.add(mesh.userData.trail.line);
            scene.add(mesh);
        });

        // Animace
        let time = 0;
        function animate() {
            requestAnimationFrame(animate);
            const time = Date.now() * 0.05;

            sun.rotation.y -= 0.005;

            scene.children.forEach(child => {
                if (child !== sun && child instanceof THREE.Mesh) {
                    const planetData = child.userData;

                    // Výpočet eliptické dráhy
                    const angle = time * planetData.speed;
                    const r = planetData.semiMajorAxis * (1 - planetData.eccentricity**2) / 
                            (1 + planetData.eccentricity * Math.cos(angle));
                    
                    // Základní pozice v orbitální rovině
                    const x = r * Math.cos(angle);
                    const z = r * Math.sin(angle);
                    
                    // Aplikace náklonu dráhy
                    const y = Math.sin(angle) * Math.sin(planetData.inclination) * r;
                    
                    // Rotace pozice podle sklonu
                    child.position.set(x, y, z);
                    child.rotation.y += 0.01;

                    // Aktualizace stopy
                    planetData.trail.update(child.position);
                }
            });

            camera.lookAt(sun.position);
            renderer.render(scene, camera);
        }

        // Responzivita
        window.addEventListener('resize', () => {
            camera.aspect = solarSystemContainer.clientWidth / solarSystemContainer.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(solarSystemContainer.clientWidth, solarSystemContainer.clientHeight);
        });

        animate();

    } catch (error) {
        console.error("Chyba:", error);
        alert("Aplikaci nelze spustit: " + error.message);
    }
}

// Spuštění po kliknutí
document.getElementById("solar-system-link").addEventListener("click", (e) => {
    e.preventDefault();
    const container = document.getElementById("solar-system-container");
    if (container && !container.querySelector('canvas')) {
        initSolarSystem();
    }
});