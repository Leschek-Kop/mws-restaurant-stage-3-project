/**
* Import idb.
 */
{
    'use strict';

    (function() {
      function toArray(arr) {
        return Array.prototype.slice.call(arr);
      }

      function promisifyRequest(request) {
        return new Promise(function(resolve, reject) {
          request.onsuccess = function() {
            resolve(request.result);
          };

          request.onerror = function() {
            reject(request.error);
          };
        });
      }

      function promisifyRequestCall(obj, method, args) {
        var request;
        var p = new Promise(function(resolve, reject) {
          request = obj[method].apply(obj, args);
          promisifyRequest(request).then(resolve, reject);
        });

        p.request = request;
        return p;
      }

      function promisifyCursorRequestCall(obj, method, args) {
        var p = promisifyRequestCall(obj, method, args);
        return p.then(function(value) {
          if (!value) return;
          return new Cursor(value, p.request);
        });
      }

      function proxyProperties(ProxyClass, targetProp, properties) {
        properties.forEach(function(prop) {
          Object.defineProperty(ProxyClass.prototype, prop, {
            get: function() {
              return this[targetProp][prop];
            },
            set: function(val) {
              this[targetProp][prop] = val;
            }
          });
        });
      }

      function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
        properties.forEach(function(prop) {
          if (!(prop in Constructor.prototype)) return;
          ProxyClass.prototype[prop] = function() {
            return promisifyRequestCall(this[targetProp], prop, arguments);
          };
        });
      }

      function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
        properties.forEach(function(prop) {
          if (!(prop in Constructor.prototype)) return;
          ProxyClass.prototype[prop] = function() {
            return this[targetProp][prop].apply(this[targetProp], arguments);
          };
        });
      }

      function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
        properties.forEach(function(prop) {
          if (!(prop in Constructor.prototype)) return;
          ProxyClass.prototype[prop] = function() {
            return promisifyCursorRequestCall(this[targetProp], prop, arguments);
          };
        });
      }

      function Index(index) {
        this._index = index;
      }

      proxyProperties(Index, '_index', [
        'name',
        'keyPath',
        'multiEntry',
        'unique'
      ]);

      proxyRequestMethods(Index, '_index', IDBIndex, [
        'get',
        'getKey',
        'getAll',
        'getAllKeys',
        'count'
      ]);

      proxyCursorRequestMethods(Index, '_index', IDBIndex, [
        'openCursor',
        'openKeyCursor'
      ]);

      function Cursor(cursor, request) {
        this._cursor = cursor;
        this._request = request;
      }

      proxyProperties(Cursor, '_cursor', [
        'direction',
        'key',
        'primaryKey',
        'value'
      ]);

      proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
        'update',
        'delete'
      ]);

      // proxy 'next' methods
      ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
        if (!(methodName in IDBCursor.prototype)) return;
        Cursor.prototype[methodName] = function() {
          var cursor = this;
          var args = arguments;
          return Promise.resolve().then(function() {
            cursor._cursor[methodName].apply(cursor._cursor, args);
            return promisifyRequest(cursor._request).then(function(value) {
              if (!value) return;
              return new Cursor(value, cursor._request);
            });
          });
        };
      });

      function ObjectStore(store) {
        this._store = store;
      }

      ObjectStore.prototype.createIndex = function() {
        return new Index(this._store.createIndex.apply(this._store, arguments));
      };

      ObjectStore.prototype.index = function() {
        return new Index(this._store.index.apply(this._store, arguments));
      };

      proxyProperties(ObjectStore, '_store', [
        'name',
        'keyPath',
        'indexNames',
        'autoIncrement'
      ]);

      proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
        'put',
        'add',
        'delete',
        'clear',
        'get',
        'getAll',
        'getKey',
        'getAllKeys',
        'count'
      ]);

      proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
        'openCursor',
        'openKeyCursor'
      ]);

      proxyMethods(ObjectStore, '_store', IDBObjectStore, [
        'deleteIndex'
      ]);

      function Transaction(idbTransaction) {
        this._tx = idbTransaction;
        this.complete = new Promise(function(resolve, reject) {
          idbTransaction.oncomplete = function() {
            resolve();
          };
          idbTransaction.onerror = function() {
            reject(idbTransaction.error);
          };
          idbTransaction.onabort = function() {
            reject(idbTransaction.error);
          };
        });
      }

      Transaction.prototype.objectStore = function() {
        return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
      };

      proxyProperties(Transaction, '_tx', [
        'objectStoreNames',
        'mode'
      ]);

      proxyMethods(Transaction, '_tx', IDBTransaction, [
        'abort'
      ]);

      function UpgradeDB(db, oldVersion, transaction) {
        this._db = db;
        this.oldVersion = oldVersion;
        this.transaction = new Transaction(transaction);
      }

      UpgradeDB.prototype.createObjectStore = function() {
        return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
      };

      proxyProperties(UpgradeDB, '_db', [
        'name',
        'version',
        'objectStoreNames'
      ]);

      proxyMethods(UpgradeDB, '_db', IDBDatabase, [
        'deleteObjectStore',
        'close'
      ]);

      function DB(db) {
        this._db = db;
      }

      DB.prototype.transaction = function() {
        return new Transaction(this._db.transaction.apply(this._db, arguments));
      };

      proxyProperties(DB, '_db', [
        'name',
        'version',
        'objectStoreNames'
      ]);

      proxyMethods(DB, '_db', IDBDatabase, [
        'close'
      ]);

      // Add cursor iterators
      // TODO: remove this once browsers do the right thing with promises
      ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
        [ObjectStore, Index].forEach(function(Constructor) {
          // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
          if (!(funcName in Constructor.prototype)) return;

          Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
            var args = toArray(arguments);
            var callback = args[args.length - 1];
            var nativeObject = this._store || this._index;
            var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
            request.onsuccess = function() {
              callback(request.result);
            };
          };
        });
      });

      // polyfill getAll
      [Index, ObjectStore].forEach(function(Constructor) {
        if (Constructor.prototype.getAll) return;
        Constructor.prototype.getAll = function(query, count) {
          var instance = this;
          var items = [];

          return new Promise(function(resolve) {
            instance.iterateCursor(query, function(cursor) {
              if (!cursor) {
                resolve(items);
                return;
              }
              items.push(cursor.value);

              if (count !== undefined && items.length == count) {
                resolve(items);
                return;
              }
              cursor.continue();
            });
          });
        };
      });

      var exp = {
        open: function(name, version, upgradeCallback) {
          var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
          var request = p.request;

          if (request) {
            request.onupgradeneeded = function(event) {
              if (upgradeCallback) {
                upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
              }
            };
          }

          return p.then(function(db) {
            return new DB(db);
          });
        },
        delete: function(name) {
          return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
        }
      };

      if (typeof module !== 'undefined') {
        module.exports = exp;
        module.exports.default = module.exports;
      }
      else {
        self.idb = exp;
      }
    }());
}


/**
* Variables Service Worker.
 */
const versionNo = 1;
const version = `v${versionNo}`;
const staticCachName = 'restaurant-local-'+version;
const contentImgsCache = 'restaurant-imgs-'+version;
const contentCache = 'restaurant-web-'+version;
const idbName = 'restaurant-db-';

/**
* Create DB
*/
//Promise welcher zum setzen und holen von items in der DB ist
let dbPromise = idb.open(idbName+version, versionNo, upgradeDB => {
  // Note: we don't use 'break' in this switch statement,
  // the fall-through behaviour is what we want.
  switch (upgradeDB.oldVersion) {
    case 0:
        var restaurantsStore = upgradeDB.createObjectStore(idbName+version, {
            keyPath: 'id'
        });
        restaurantsStore.createIndex('by-id','id');
    }
});


/**
* Install Service Worker.
 */
self.addEventListener('install', (event) => {
    const urlToCache = [
        '/',
        '/favicon.ico.png',
        '/manifest.json',
        'sw.js',
        'js/main.js',
        'js/dbhelper.js',
        'js/restaurant_info.js',
        'css/styles.css'
    ];
    event.waitUntil(
        caches.open(staticCachName).then((cache) => {
            return cache.addAll(urlToCache);
        })
    );
});

/**
* fetch events.
 */
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    //console.info(event.request);
    if(requestUrl.origin === location.origin){
        if(requestUrl.pathname.startsWith('/img/')){
            event.respondWith(
                servePhoto(event.request)
            );
            return;
        }
    }
    if (event.request.url.indexOf('https://') == 0) {
        event.respondWith(
            serveContent(event.request)
        );
    }else if (requestUrl.search.indexOf('?is_favorite=') == 0) {
        event.respondWith(
            updateFavRestaurant(event.request)
        );
    }else if (requestUrl.pathname === '/reviews/' && requestUrl.search !== '') {
        event.respondWith(
            serveReviews(event.request)
        );
    }else if (requestUrl.pathname === '/reviews/') {
        event.respondWith(
            addReview(event.request)
        );
    }else if (requestUrl.pathname === '/offline/') {   
        event.respondWith(
            addOfflineReview(getReviewFromSearch(requestUrl.search))
        );
    }else if (requestUrl.pathname === '/sendOfflineReviews/') {   
        event.respondWith(
            sendOfflineReview(requestUrl)
        );
    }else {
        event.respondWith(
            serveSite(event.request)
        );
    }
});

/**
* Get review Information out of search
 */
getReviewFromSearch = (search) => {
    let review = search.slice(2,search.length-1);
    //Replace %22 & %20
    while(true){
        let str = review.replace('%22', '').replace('%20', '');
        if(review === str) break;
        review = str;
    }
    //Code from: https://stackoverflow.com/questions/1086404/string-to-object-in-js
    var properties = review.split(',');
    var obj = {};
    properties.forEach(function(property) {
        var tup = property.split(':');
        obj[tup[0]] = tup[1];
    });
    obj.restaurant_id = parseInt(obj.restaurant_id);
    obj.rating = parseInt(obj.rating);
    return obj;
}

/**
* handle restaurant-imgs cache.
 */
servePhoto = (request)  => {
    const imgKey = '/img/';
    const posImg = request.url.indexOf(imgKey);
    const storageUrl = request.url.slice(0, posImg + imgKey.length + 1);
    return caches.open(contentImgsCache).then((cache) => {
        return cache.match(storageUrl).then((response) => {
            if (response) return response;

            return fetch(request).then((networkResponse) => {
                cache.put(storageUrl, networkResponse.clone());
                return networkResponse;
            });
        });
    });
}

/**
* handle restaurant-web cache.
 */
serveContent = (request) => {
    const storageUrl = request.url;
    return caches.open(contentCache).then((cache) => {
        return cache.match(storageUrl).then((response) => {
            if (response) return response;

            return fetch(request).then((networkResponse) => {
                cache.put(storageUrl, networkResponse.clone());
                return networkResponse;
            });
        });
    });
}

/**
* handle favorite restaurant update in db.
 */
updateFavRestaurant = (request) => {
    //TODO Handler um die DB informationen zu updaten (bei erfolg!) und die request raus zuschicken!
    return fetch(request).then((networkResponse) => {
        if (networkResponse.status == 200){
            const url = new URL(networkResponse.url);
            const posNo = url.pathname.indexOf('ts/') + 3;
            const id = parseInt(url.pathname.slice(posNo, url.pathname.length - 1));
            let isFav = url.search.slice(-4);
            if (isFav == 'true'){
                isFav = true;
            }else {
                isFav = false;
            }
            //update DB
            let dbProm = idb.open(idbName+version, versionNo);
            dbProm.then(db => {
                return db.transaction(idbName+version).objectStore(idbName+version).get(id);
            }).then(obj => {
                obj.data.is_favorite = isFav;
                idb.open(idbName+version, versionNo).then(db => {
                    return db.transaction(idbName+version, 'readwrite').objectStore(idbName+version).put(obj);
                });
            });
        }
        return networkResponse;
    });
}

/**
* handle restaurant-local cache and idb data.
 */
serveReviews = (request) => {
    const id = parseInt(request.url.slice(request.url.indexOf('=') + 1));
    let dbReviews = idb.open(idbName+version, versionNo).then(db => {
        return db.transaction(idbName+version).objectStore(idbName+version).get(id);
    }).then(obj => {
        if(obj.data.reviews){
            let reviews;
            if(obj.data.offline){
                reviews = obj.data.reviews.concat(obj.data.offline);
            }else{
                reviews = obj.data.reviews;
            }
            return reviews;
        }
    });
    //Try getting new Reviews
    return fetch(request).then((networkResponse) => {
        if (networkResponse.status == 200){
            let dbProm = idb.open(idbName+version, versionNo);
            const nrclone = networkResponse.clone();
            nrclone.json().then(data => {
                dbProm.then(db => {
                    return db.transaction(idbName+version).objectStore(idbName+version).get(id);
                }).then(obj => {
                    obj.data.reviews = data;
                    idb.open(idbName+version, versionNo).then(db => {
                        return db.transaction(idbName+version, 'readwrite').objectStore(idbName+version).put(obj);
                    });
                });
            });
        }
        return networkResponse;
    }).catch(e => {
        return dbReviews.then(d => {
            return new Response(JSON.stringify(d), { "status" : 200 , "statusText" : "OK" });
        });
    });
}

/**
* Add new review to Server
*/
addReview = (request) => {
    // Schaue vorher ob in der Offline db was ist und sende dies mit
    return fetch(request).then((networkResponse) => {
        if (networkResponse.status == 201){
            return networkResponse;
        }else{
            console.log('...something went wrong!!');
        }
    });
}

/**
* Add new review to offline - db in case there is no connection
*/
addOfflineReview = (OfflineReview) => {
    let dbProm = idb.open(idbName+version, versionNo);
    dbProm.then(db => {
        return db.transaction(idbName+version).objectStore(idbName+version).get(OfflineReview.restaurant_id);
    }).then(obj => {
        if(!obj.data.offline) obj.data.offline = [];
        obj.data.offline.push(OfflineReview);
        idb.open(idbName+version, versionNo).then(db => {
            return db.transaction(idbName+version, 'readwrite').objectStore(idbName+version).put(obj);
        });
    });
    return new Response();
}


/**
* handle restaurant-local cache and idb data.
 */
serveSite = (request) => {
    var reqUrl = new URL(request.url);
    var storageUrl = request.url;    
    if (reqUrl.pathname === '/restaurants'){// Put restaurant data to idb -> NEW code        
        //Nothing found in idb
        //Check db if data is available
        return dbPromise.then(db => {
            return db.transaction(idbName+version).objectStore(idbName+version).getAll();
        }).then((allData) => {
            if (allData.length !== 0) {
                let data = [];
                for (let i = 0;i < allData.length; i++){
                    data.push(allData[i].data);
                }
                return {data: data, typ: 'idb'};//return data from idb
            }else{
                return fetch(storageUrl).then((networkResponse) => {//return data from internet
                    return networkResponse.json();
                }).then((data) => {
                    //Adding to idb
                    dbPromise.then(db => {
                        const tx = db.transaction(idbName+version, 'readwrite');
                        data.forEach((d) => {
                            if(d.is_favorite && typeof(d.is_favorite) != 'boolean'){
                                if(d.is_favorite === 'true'){
                                    d.is_favorite = true;
                                }else{
                                    d.is_favorite = false;
                                }
                            }
                            tx.objectStore(idbName+version).put({
                                id: d['id'],
                                data: d
                            });
                        });
                        return tx.complete;
                    });
                    return {data: data, typ: 'internet'};
                });
            }
        }).then((data) => {
            return new Response(JSON.stringify(data['data']), { "status" : 200 , "statusText" : "OK" });
        });
    }else{// Cache page data -> OLD code
        if(request.url.indexOf('?') != -1){
            storageUrl = storageUrl.slice(0, request.url.indexOf('?'));
        }
        return caches.open(staticCachName).then((cache) => {
            return cache.match(request.url).then((response) => {
                if (response) return response;
                return fetch(request).then((networkResponse) => {
                    cache.put(request.url, networkResponse.clone());
                    return networkResponse;
                });
            });
        });
    }
}

/**
* Send all Offline Reviews to Server and delete them from db.
 */
sendOfflineReview = (url) => {
    let dbProm = idb.open(idbName+version, versionNo);
    dbProm.then(db => {
            return db.transaction(idbName+version).objectStore(idbName+version).getAll();
        }).then((allData) => {
            let data = [];
            for (let i = 0;i < allData.length; i++){
                data.push(allData[i].data);
            }
            return data;//return data from idb
        }).then((data) => {
            for (let i = 0;i < data.length; i++){
                if(data[i].offline){
                    let offlineReviews = data[i].offline;
                    delete data[i].offline;
                   offlineReviews.forEach(offlineReview => {
                       return fetch(`${url.origin}/reviews/`, {
                           method: 'POST',
                           body: JSON.stringify(offlineReview)
                       });
                   });
                }
            }
            return data;
    }).then(data => {
        let dbProm = idb.open(idbName+version, versionNo);
        dbProm.then(db => {
            //TODO Update offline to reviews
            //Adding to idb
            const tx = db.transaction(idbName+version, 'readwrite');
            tx.objectStore(idbName+version).clear();
            data.forEach((d) => {
                if(d.is_favorite && typeof(d.is_favorite) != 'boolean'){
                    if(d.is_favorite === 'true'){
                        d.is_favorite = true;
                    }else{
                        d.is_favorite = false;
                    }
                }
                tx.objectStore(idbName+version).put({
                    id: d['id'],
                    data: d
                });
            });
            return tx.complete;
        });
    });
    return new Response();
}