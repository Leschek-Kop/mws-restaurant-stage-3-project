/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
      fetch(DBHelper.DATABASE_URL).then((response) => {
          if (response.status === 200) { // Got a success response from server!
              return response.json();
          } else { // Oops!. Got an error from server.
              const error = (`Request failed. Returned status of ${response.status}`);
              callback(error, null);
          }
      }).then((data)=>{
          if(!data){
              const error = (`Parse data to json failed.`);
              callback(error, null);
          }else{
              data.forEach(d =>{
              if(d.is_favorite && typeof(d.is_favorite) != 'boolean'){
                  if(d.is_favorite === 'true'){
                      d.is_favorite = true;
                  }else{
                      d.is_favorite = false;
                  }
              }
              })
              callback(null, data);  
          }
      }).catch((e) => {
          console.log('uuppps fetching restaurant data went wrong. Error: ', e);
      });
  }

  /**
   * Fetch restaurants review by id.
   */
  static fetchRestaurantReview(id, callback){
      const url = new URL(DBHelper.DATABASE_URL);
      fetch(`${url.origin}/reviews/?restaurant_id=${id}`).then((response) => {
          if (response.status === 200) { // Got a success response from server!
              return response.json();
          } else { // Oops!. Got an error from server.
              const error = (`Request failed. Returned status of ${response.status}`);
              callback(error, null);
          }
      }).then((data)=>{
          if(!data){
              const error = (`Parse data to json failed.`);
              callback(error, null);
          }else{
              callback(null, data);
          }
      }).catch((e) => {
          console.log('uuppps fetching restaurants review went wrong. Error: ', e);
      });
  }

  /**
  * send new review to server
  */
  static addNewReview(review, callback){
      const url = new URL(DBHelper.DATABASE_URL);
      fetch(`${url.origin}/reviews/`, {
          method: 'POST',
          body: JSON.stringify(review)
      }).then(obj => {
          //TODO Handler bei Erfolg
          console.log('Review successfully uploaded ', obj);
          callback(null, obj);
      }).catch((e) => {
          console.log('uuppps sending restaurants review to server went wrong. Error: ', e);
          callback(e, null);
      });
  }
    
  /**
  * send offline information to SW
  */
  static addOfflineReview(review, callback){
      const url = new URL(DBHelper.DATABASE_URL);
      fetch(`${url.origin}/offline/?${JSON.stringify(review)}`, {
          method: 'POST'
      }).then(obj => {
          //TODO Handler bei Erfolg
          callback(null, obj);
      }).catch((e) => {
          callback(e, null);
      });
  }
    
  /**
   * Update favorite Restaurant.
   */
  static updateFavRestaurant(id, isFav, callback){
      fetch(`${DBHelper.DATABASE_URL}/${id}/?is_favorite=${isFav}`, {
          method: 'PUT'
      }).then((response) => {
          if (response.status === 200) { // Got a success response from server!
              return response.json();
          } else { // Oops!. Got an error from server.
              const error = (`Request failed. Returned status of ${response.status}`);
              callback(error, null);
          }
      }).then((data)=>{
          if(!data){
              const error = (`Parse data to json failed.`);
              callback(error, null);
          }else{
              data.is_favorite = (data.is_favorite == 'true');
              callback(null, data);
          }
      }).catch((e) => {
          console.log('uuppps updating favorite restaurant went wrong. Error: ', e);
      });
  }
    
  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant, w= "270", s="s") {
      if(restaurant.photograph){
          const idxDot = 1;
          return (`/img/${restaurant.photograph.slice(0, idxDot)}-${w}_${s}${restaurant.photograph.slice(idxDot, restaurant.photograph.length)}.jpg`);
      }
      return (`/img/altImg-${w}_${s}.jpg`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }

  /**
   * send all offline reviews to server.
   */
  static sendOfflineReviewsToServer(){
      const url = new URL(DBHelper.DATABASE_URL);
      fetch(`${url.origin}/sendOfflineReviews/`, {
          method: 'POST'
      });
  }
}