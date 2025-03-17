// Přidání planet do kontejneru
const planets = ["Merkur", "Venuše", "Země", "Mars", "Jupiter", "Saturn", "Uran", "Neptun"];
const planetContainer = document.getElementById("planet-container");

planets.forEach(planet => {
    const planetDiv = document.createElement("div");
    planetDiv.className = "planet";
    planetDiv.textContent = planet;
    planetDiv.addEventListener("click", () => alert(`Vybrali jste planetu: ${planet}`));
    planetContainer.appendChild(planetDiv);
});