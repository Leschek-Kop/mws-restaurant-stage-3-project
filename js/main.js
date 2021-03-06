let restaurants,
  neighborhoods,
  cuisines
var map
var markers = []

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    startServiceWorker();
    fetchNeighborhoods();
    fetchCuisines();
  
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();
}

/**
 * Add additional elements to HTML.
 * a11y audit: iframe title
 */
window.onload = () => {
  var iframeDocument = document.getElementsByTagName('iframe')[0];
  iframeDocument.title = 'Map content';
}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');
  const image = document.createElement('img');
  image.alt = `${restaurant.name}, a ${restaurant.cuisine_type} restaurant in ${restaurant.neighborhood}.`;  
  const picture = document.createElement('picture');
  const source = document.createElement('source');
  let observer = new IntersectionObserver(viewPic, {
      threshold: 0.3
  });
  observer.observe(picture);
    
    
  const loadPicture = () => {
      image.className = 'restaurant-img';
      image.srcset = `${DBHelper.imageUrlForRestaurant(restaurant, w='540', s='s_2x', e='webp')} 2x,  ${DBHelper.imageUrlForRestaurant(restaurant, w='270', s='s', e='webp')} 1x`;
      image.src = DBHelper.imageUrlForRestaurant(restaurant);
      source.media = '(min-width: 300px)';
      source.srcset=`${DBHelper.imageUrlForRestaurant(restaurant, w='600', s='m_2x', e='webp')} 2x, ${DBHelper.imageUrlForRestaurant(restaurant, w='300', s='m', e='webp')} 1x`;
  }
  function viewPic(changes, observer){
      changes.forEach(change => {
          if(change.intersectionRatio > 0.1){
              loadPicture(change.target);
                  observer.unobserve(change.target);
          }
      });
  }
  picture.append(source);
  picture.append(image);
  li.append(picture);
    
  const favHeart = document.createElement('div');
  favHeart.setAttribute('title', 'mark as one of your favorite restaurants');
  favHeart.setAttribute('class', 'heart');
  
  favHeart.onclick = function(){
      restaurant.is_favorite = !restaurant.is_favorite;
      DBHelper.updateFavRestaurant(restaurant.id, restaurant.is_favorite, (error, restaurants) => {
          if (error) { // Got an error!
              //TODO Information wenn was schief gegangen ist!
              console.error(error);
          } else {
               this.classList.toggle('fav');
          }
      });
  }
  if (restaurant.is_favorite) {
      favHeart.classList.toggle('fav');
  }
  li.append(favHeart);
    
  const name = document.createElement('h2');
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  var att = document.createAttribute('aria-label');
  att.value = `View details for ${restaurant.name}, a ${restaurant.cuisine_type} restaurant in ${restaurant.neighborhood}.`;
  more.setAttributeNode(att);
  li.append(more);

  return li;
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
}

/**
 * set focus to new element.
 */
changeFocus = () => {
  document.querySelector('h2').focus();
}

/**
 * register Service Worker.
 */
startServiceWorker =() =>{
  if (!navigator.serviceWorker) return;
  var indexController = this;
  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    if (!navigator.serviceWorker.controller) return;
  }).catch(function(){
    console.log('Registration failed');
  });
}

/**
 * on Online event, will send all offline Reviews to server.
 */
window.addEventListener("online", DBHelper.sendOfflineReviewsToServer);