
import { Wheel } from 'https://cdn.jsdelivr.net/npm/spin-wheel@5.0.2/dist/spin-wheel-esm.js';
let isSpinning = false;
let map, userMarker, nearbyRestaurants = [];
let selectedMarker = null; // To store the red marker
let restaurantMarkers = []; // Store all restaurant markers for clearing later
const redIcon = L.icon({
    iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
});

const greenIcon = L.icon({
    iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
});

const blueIcon = L.icon({
    iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
});

const colorPattern = ["#f28c28", "#c5e0b4", "#ffc000", "#ed7d31", "#a9d18e", "#4472c4", "#70ad47", "#d9d9d9", "#ff9da7", "#c55a11"];

// Function to abbreviate names longer than 15 characters
function abbreviateName(name) {
    if (name.length <= 25) return name;

    const words = name.split(' ');
    if (words.length === 1) return name.substring(0, 15);

    let abbreviation = '';
    if (words[0].toLowerCase() === 'the' && words.length > 1) {
        abbreviation = 'The ';
        words.shift();
    }
    abbreviation += words.map(word => word.charAt(0).toUpperCase()).join('');
    return abbreviation;
}
const props = {
    items: [],
    itemBackgroundColors: [], // Colors for slices (dynamically populated)
    itemLabelColors: ["#000000"], // Change text color to black for readability
    textSize: 100, // Adjust the text size for better visibility
    textFont: "Arial", // Use a clean and readable font
    itemLabelFontSizeMax: 200,
    isInteractive: false,
    // itemLabelRadius: 0.9,
    pointerAngle: 180,
    onRest: (event) => {
        const chosenLabel = document.getElementById('chosenLabel');
        const winningItem = props.items[event.currentIndex];

        // Reset all restaurant markers to blue
        restaurantMarkers.forEach(marker => marker.setIcon(blueIcon));

        // Get the restaurant details
        const restaurant = nearbyRestaurants.find(r => abbreviateName(r.name) === winningItem.label);
        if (restaurant) {
            const [lat, lng] = restaurant.coordinates;

            // Set the chosen restaurant's marker to green
            const chosenMarker = restaurantMarkers.find(marker => marker.getLatLng().lat === lat && marker.getLatLng().lng === lng);
            if (chosenMarker) {
                chosenMarker.setIcon(greenIcon);
            }

            // Create a Google Maps link for the restaurant
            const googleMapsUrl = restaurant.link || `https://www.google.com/maps?q=${lat},${lng}`;

            // Display the restaurant name as a clickable hyperlink
            chosenLabel.innerHTML = `THE GYATTS HAS CHOSEN... <a href="${googleMapsUrl}" target="_blank" style="color: red; font-weight: bold; text-decoration: none;">${restaurant.name}</a>`;
        } else {
            chosenLabel.innerHTML = `THE GYATTS HAS CHOSEN... ${winningItem.label}`;
        }
    }
};



async function loadRestaurants() {
    const csvFiles = ['dataset1.csv', 'dataset2.csv']; 

    try {
        // Fetch all CSV files in parallel
        const responses = await Promise.all(csvFiles.map(file => fetch(file)));
        const csvTexts = await Promise.all(responses.map(res => res.text()));

        return new Promise((resolve) => {
            let allRestaurants = [];

            csvTexts.forEach(csvText => {
                Papa.parse(csvText, {
                    header: true, // Treat first row as headers
                    skipEmptyLines: true,
                    complete: (result) => {
                        const restaurants = result.data.map(row => {
                            let coordinates;
                            if (row.coordinates) {
                                coordinates = JSON.parse(row.coordinates);
                                return {
                                    name: row.name.trim(),
                                    coordinates: [coordinates.latitude, coordinates.longitude],
                                    link: row.link,
                                    featured_image: row.featured_image,
                                    main_category: row.main_category
                                };
                            } else {
                                return {
                                    name: row.name.trim(),
                                    coordinates: [
                                        parseFloat(row.latitude),
                                        parseFloat(row.longitude)
                                    ]
                                };
                            }
                        });

                        // Merge all restaurants from all CSVs
                        allRestaurants = allRestaurants.concat(restaurants);
                    },
                    error: (error) => {
                        console.error("Error parsing CSV:", error);
                    }
                });
            });

            // Resolve after all CSVs are parsed
            resolve(allRestaurants);
        });
    } catch (error) {
        console.error("Error loading restaurants:", error);
        return [];
    }
}


// Initialize the map with Leaflet.js
function initMap(userLocation) {
    // Ensure the map container is present
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error("Map container not found!");
        return;
    }

    // Initialize the Leaflet map
    map = L.map('map', {
        center: [userLocation.lat, userLocation.lng],
        zoom: 15
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add a marker for the user's location
    userMarker = L.marker([userLocation.lat, userLocation.lng]).addTo(map).bindPopup('Your Location').openPopup();

    // Force the map to resize after rendering
    setTimeout(() => {
        if (map) {
            console.log("Invalidating map size...");
            map.invalidateSize();
        }
    }, 300); // Increase timeout to ensure container is fully rendered

    // Load restaurants first, then apply filters
    loadRestaurants().then(restaurants => {
        nearbyRestaurants = restaurants; // Cache the restaurants
        applyFilters(userLocation); // Apply filters after restaurants are loaded
    });

    // Allow the user to click on the map to select a new location
    map.on("click", (event) => {
        if (isSpinning) {
            alert("You cannot change the location while the wheel is spinning!");
            return;
        }

        const { lat, lng } = event.latlng;

        if (userMarker) {
            userMarker.setLatLng([lat, lng]).setIcon(redIcon).bindPopup('Selected Location').openPopup();
        } else {
            userMarker = L.marker([lat, lng], { icon: redIcon }).addTo(map).bindPopup('Selected Location').openPopup();
        }

        const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        document.getElementById('selectedLocation').innerHTML = `Selected Location: <a href="${googleMapsUrl}" target="_blank">${googleMapsUrl}</a>`;

        clearRestaurantMarkers();
        applyFilters({ lat, lng });
    });
}

// Function to open modal
function openImageModal(imageUrl) {
    let modal = document.getElementById("imageModal");
    let modalImg = document.getElementById("modalImage");
    
    modal.style.display = "block";
    modalImg.src = imageUrl;
  }
  
  // Function to close modal
  function closeImageModal() {
    document.getElementById("imageModal").style.display = "none";
  }

  // Function to check if the image URL is valid
function checkImageUrl(url, callback) {
    const img = new Image();
    img.onload = () => callback(true);  // Image loaded successfully
    img.onerror = () => callback(false);  // Error loading image
  
    img.src = url;
  }
  
// Apply filters to find and display nearby restaurants
async function applyFilters(userLocation) {
    const proximity = parseFloat(document.getElementById("proximity").value); // Selected proximity filter
    const defaultCount = parseInt(document.getElementById("count").value, 10); // Selected maximum count

    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = "";

    if (!nearbyRestaurants.length) {
        console.error("Restaurants data not loaded yet!");
        return;
    }

    // Filter restaurants based on proximity
    const filteredRestaurants = nearbyRestaurants
        .filter(({ coordinates }) => {
            const [lat, lng] = coordinates; // Reverse order
            
            return calculateDistance(userLocation.lat, userLocation.lng, lat, lng) <= proximity;
        });

    // Adjust the count dynamically based on available restaurants
    const count = Math.min(defaultCount, filteredRestaurants.length); // Use the smaller number

    // Limit the filtered restaurants to the adjusted count
    const limitedRestaurants = filteredRestaurants.slice(0, count);
    const defaultImage = 'images/Food.png';
    if (limitedRestaurants.length > 0) {
        resultsDiv.innerHTML = `<h3>Nearby Restaurants (Showing ${limitedRestaurants.length} of ${filteredRestaurants.length}):</h3>`;
        props.items = limitedRestaurants.map(({ name }) => ({ label: abbreviateName(name) })); // Populate wheel with restaurants
        limitedRestaurants.forEach(({ name, coordinates, link, featured_image }) => {
            // Check if the featured image is valid
            
            const [lng, lat] = coordinates; // Reverse order for Leaflet
            const marker = L.marker([lat, lng]).addTo(map).bindPopup(name); // Leaflet expects [lat, lng]
            restaurantMarkers.push(marker); // Store marker for later removal
           
            checkImageUrl(featured_image, function(isValid) {
            const imageSrc = isValid ? featured_image : defaultImage;
            resultsDiv.innerHTML += `<p> 
  <img src="${imageSrc}" 
       alt="Image" 
       width="50" 
       height="50" 
       class="thumbnail"
       style="vertical-align: middle; border-radius: 5px; margin-right: 10px;">
  ${name} 
  <a href="${link}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">🔗</a>
</p>`;
});

        });

        refreshWheel(); // Refresh the wheel with the updated restaurant list
    } else {
        resultsDiv.innerHTML = "<p>No restaurants found within the selected filters.</p>";
        props.items = []; // Clear the wheel if no items
        refreshWheel(); // Clear the wheel
    }
}






// Clear existing restaurant markers from the map
function clearRestaurantMarkers() {
    restaurantMarkers.forEach(marker => map.removeLayer(marker)); // Remove each marker from the map
    restaurantMarkers = []; // Clear the markers array
}

// Calculate the distance between two coordinates
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// Refresh the wheel after updating restaurants
let wheel;
function refreshWheel() {
    const container = document.querySelector('.wheel-container');
    container.innerHTML = ""; // Clear the existing wheel

    // Dynamically assign colors based on the number of restaurants
    props.itemBackgroundColors = props.items.map((_, index) => colorPattern[index % colorPattern.length]);

    if (props.items.length > 0) {
        wheel = new Wheel(container, props); // Recreate the wheel with updated props
    }

    // Add the pointer back
    const pointer = document.createElement('div');
    pointer.className = 'pointer';
    container.appendChild(pointer);
}

function updateSelectedLocation(lat, lng) {
    // Update the user's marker
    if (userMarker) {
        userMarker.setLatLng([lat, lng]).setIcon(redIcon).bindPopup('Selected Location').openPopup();
    } else {
        userMarker = L.marker([lat, lng], { icon: redIcon }).addTo(map).bindPopup('Selected Location').openPopup();
    }

    // Update the selected location text
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    document.getElementById('selectedLocation').innerHTML = `Selected Location: <a href="${googleMapsUrl}" target="_blank">${googleMapsUrl}</a>`;

    // Reapply filters for the new location
    clearRestaurantMarkers();
    applyFilters({ lat, lng });
}


// Get the user's current location
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Use the centralized function to update the location
                updateSelectedLocation(userLocation.lat, userLocation.lng);

                // Center the map on the user's current location
                map.setView([userLocation.lat, userLocation.lng], 15);
            },
            () => alert("Geolocation failed or permission denied!")
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}



document.addEventListener("DOMContentLoaded", () => {
    const initialLocation = { lat: 1.3521, lng: 103.8198 }; // Default location (Singapore)
    initMap(initialLocation);

    document.getElementById("useCurrentLocation").addEventListener("click", () => {
        getUserLocation(); // Use the user's current location when the button is clicked
    });

    // Reapply filters when dropdowns change
    document.getElementById("proximity").addEventListener("change", () => {
        if (userMarker) {
            applyFilters(userMarker.getLatLng());
            refreshWheel();
        }
    });
    document.getElementById("count").addEventListener("change", () => {
        if (userMarker) {
            applyFilters(userMarker.getLatLng());
            refreshWheel();
        }
    });
    // Utility function to enable or disable buttons
    function toggleButtons(disabled) {
        document.getElementById('spinButton').disabled = disabled;
        document.getElementById('useCurrentLocation').disabled = disabled;
        document.getElementById('proximity').disabled = disabled;
        document.getElementById('count').disabled = disabled;
        document.getElementById("spinDuration").disabled = disabled;

        const buttons = document.querySelectorAll('button, select');
        buttons.forEach(button => {
            button.style.opacity = disabled ? 0.5 : 1; // Add visual feedback
            button.style.pointerEvents = disabled ? "none" : "auto";
        });

    }

    // Modify the spin button event listener
    document.getElementById('spinButton').addEventListener('click', () => {
        const chosenLabel = document.getElementById('chosenLabel');
        chosenLabel.innerHTML = '';

        if (props.items.length > 0) {
            const duration = parseInt(document.getElementById('spinDuration').value, 10)
            const winningItemIndex = Math.floor(Math.random() * props.items.length);

            // Disable buttons and map interactions before spinning
            toggleButtons(true);
            isSpinning = true;

            if (wheel) {
                console.log("Wheel spin started."); // Debugging log
                wheel.spinToItem(winningItemIndex, duration); // Start the spin

                // Use setTimeout to re-enable buttons and map after the spin duration
                setTimeout(() => {
                    console.log("Wheel spin completed."); // Debugging log
                    toggleButtons(false);
                    isSpinning = false;
                }, duration);
            } else {
                console.error("Wheel not initialized!"); // Debugging log
                toggleButtons(false);
                isSpinning = false;
            }
        } else {
            alert("No nearby restaurants to spin!");
        }
    });

});

