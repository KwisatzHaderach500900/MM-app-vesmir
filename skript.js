import * as THREE from 'three';

let scene, camera, renderer;
let solarSystemContainer;

// Vytvořte globální loader pro textury
const textureLoader = new THREE.TextureLoader();

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
            1000
        );
        camera.position.set(0, 50, 200);
        camera.lookAt(0, 0, 0);

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
            { name: "Merkur", radius: 3.5, distance: 25, speed: 0.02, texture: 'textures/2k_mercury.jpg' },
            { name: "Venuše", radius: 6.8, distance: 40, speed: 0.015, texture: 'textures/2k_venus_surface.jpg'},
            { name: "Země", radius: 7, distance: 60, speed: 0.01, texture: 'textures/2k_earth_daymap.jpg'},
            { name: "Mars", radius: 5.5, distance: 80, speed: 0.008, texture: 'textures/2k_mars.jpg'},
            { name: "Jupiter", radius: 11, distance: 110, speed: 0.005, texture: 'textures/2k_jupiter.jpg'},
            { name: "Saturn", radius: 10, distance: 140, speed: 0.004, texture: 'textures/2k_saturn.jpg'},
            { name: "Uran", radius: 9, distance: 170, speed: 0.003, texture: 'textures/2k_uranus.jpg'},
            { name: "Neptun", radius: 8.5, distance: 200, speed: 0.002,texture: 'textures/2k_neptune.jpg' }
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
        });

        // Animace
        let time = 0;
        function animate() {
            requestAnimationFrame(animate);
            const time = Date.now() * 0.1;

            sun.rotation.y -= 0.005;

            scene.children.forEach(child => {
                if (child !== sun && child instanceof THREE.Mesh) {
                    const planetData = child.userData;
                    child.position.x = Math.cos(time * planetData.speed) * planetData.distance;
                    child.position.z = Math.sin(time * planetData.speed) * planetData.distance;
                    child.rotation.y += 0.01;
                }
            });

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