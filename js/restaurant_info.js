let restaurant;
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
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
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const restaurantDiv = document.getElementById('restaurant-div');
  const picture = document.createElement('picture');
  const sourceXtraLarge = document.createElement('source');
  sourceXtraLarge.media = '(min-width: 900px)';
  sourceXtraLarge.srcset=`${DBHelper.imageUrlForRestaurant(restaurant, w='540', s='s_2x')} 2x, ${DBHelper.imageUrlForRestaurant(restaurant, w='270', s='s')} 1x`;
  const sourceLarge = document.createElement('source');
  sourceLarge.media = '(min-width: 400px)';
  sourceLarge.srcset=`${DBHelper.imageUrlForRestaurant(restaurant, w='740', s='l_2x')} 2x, ${DBHelper.imageUrlForRestaurant(restaurant, w='370', s='l')} 1x`;
  const sourceMedium = document.createElement('source');
  sourceMedium.media = '(min-width: 300px)';
  sourceMedium.srcset=`${DBHelper.imageUrlForRestaurant(restaurant, w='600', s='m_2x')} 2x, ${DBHelper.imageUrlForRestaurant(restaurant, w='300', s='m')} 1x`;
  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  image.srcset = `${DBHelper.imageUrlForRestaurant(restaurant, w='540', s='s_2x')} 2x, ${DBHelper.imageUrlForRestaurant(restaurant, w='270', s='s')} 1x`;
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = `${restaurant.name}, a ${restaurant.cuisine_type} restaurant in ${restaurant.neighborhood}.`;
  picture.append(sourceXtraLarge);
  picture.append(sourceLarge);
  picture.append(sourceMedium);
  picture.append(image);
  restaurantDiv.append(picture);
  restaurantDiv.append(document.getElementById('restaurant-cuisine'));
  restaurantDiv.append(document.getElementById('restaurant-address'));

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');
    var att = document.createAttribute('role');
    att.value = 'row';
    row.setAttributeNode(att);
    att = document.createAttribute('tabindex');
    att.value = '0';
    row.setAttributeNode(att);
    att = document.createAttribute('aria-label');
    att.value = `open on ${key}, ${operatingHours[key]}`;
    row.setAttributeNode(att);

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  title.id = 'reviews';
  container.appendChild(title);
  container.setAttribute('aria-labelledby', 'reviews');

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  var att = document.createAttribute('aria-label');
  att.value = `Restaurant review from ${review.name} written at ${review.date}.`;
  li.setAttributeNode(att);
  li.setAttribute('tabindex', '0');

  const head = document.createElement('div')
  head.className = 'head';
  
  const name = document.createElement('p');
  name.innerHTML = review.name;

  const date = document.createElement('span');
  date.innerHTML = review.date;
  name.appendChild(date);
  head.appendChild(name);
  li.appendChild(head);

  const rating = document.createElement('span');
  rating.className = 'rating';
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page');
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * set focus to new element.
 */
changeFocus = () => {
  document.getElementById('restaurant-name').focus();
}