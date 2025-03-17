import * as THREE from 'three';

let scene, camera, renderer;
let solarSystemContainer;

// Vytvořte globální loader pro textury
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('textures/2k_earth_daymap.jpg');

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
        camera.lookAt(0, 0, 0); // Zaměření na střed scény

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
        const sunGeometry = new THREE.SphereGeometry(6, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(sun);

        // Planety
        const planets = [
            { name: "Merkur", radius: 1.5, distance: 25, color: 0x808080, speed: 0.02 },
            { name: "Venuše", radius: 3.8, distance: 40, color: 0xffd700, speed: 0.015 },
            { name: "Země", radius: 4, distance: 60, color: 0x0000ff, speed: 0.01, texture: 'textures/2k_earth_daymap.jpg' },
            { name: "Mars", radius: 2.5, distance: 80, color: 0xff0000, speed: 0.008 },
            { name: "Jupiter", radius: 8, distance: 110, color: 0xffa500, speed: 0.005 },
            { name: "Saturn", radius: 7, distance: 140, color: 0xffd700, speed: 0.004 },
            { name: "Uran", radius: 6, distance: 170, color: 0x00ffff, speed: 0.003 },
            { name: "Neptun", radius: 5.5, distance: 200, color: 0x0000cd, speed: 0.002 }
        ];

        planets.forEach(planet => {
            const texture = textureLoader.load(planet.texture);
            const geometry = new THREE.SphereGeometry(planet.radius, 32, 32);
            const material = new THREE.MeshPhongMaterial({ color: planet.color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = planet.distance;
            mesh.userData = planet; // Uložení parametrů planety
            scene.add(mesh);
        });

        // Animace
        let time = 0;
        function animate() {
            requestAnimationFrame(animate);
            
            // Časová proměnná pro plynulý pohyb
            const time = Date.now() * 0.1;
        
            // Projdi všechny objekty ve scéně
            scene.children.forEach(child => {
                // Vynechej Slunce
                if (child === sun) return;
        
                // Pokud je to planeta
                if (child instanceof THREE.Mesh) {
                    // Získej parametry planety
                    const speed = child.userData.speed;
                    const distance = child.userData.distance;
        
                    // Pohyb po kruhové dráze (X a Z souřadnice)
                    child.position.x = Math.cos(time * speed) * distance;
                    child.position.z = Math.sin(time * speed) * distance;
        
                    // Rotace planety kolem své osy
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
    
    // Získání kontejneru PŘED voláním initSolarSystem
    const container = document.getElementById("solar-system-container");
    
    if (container && !container.querySelector('canvas')) {
        initSolarSystem();
    }
});