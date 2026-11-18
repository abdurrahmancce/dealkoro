/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "d57c874e677d421d4f2d862438aef664"
  }, {
    "url": "pwa-512x512.png",
    "revision": "6471ba5875b590920f442a417a9ba1fe"
  }, {
    "url": "pwa-192x192.png",
    "revision": "3d7499ea57ef3784d2fc4fd84cc53562"
  }, {
    "url": "index.html",
    "revision": "151246ebd6b5277ee99d7ecc3dcea7b4"
  }, {
    "url": "icon.svg",
    "revision": "da51899b20f58783dbdd7b834886f101"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "6e90ef6badb142ea859c04be0d61f7c4"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/index-D5RnJ_7A.css",
    "revision": null
  }, {
    "url": "assets/index-BYFXsqSx.js",
    "revision": null
  }, {
    "url": "assets/aistudio/image_f0b2647e.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_d921a11f.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_cc2f413a.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_ab361a13.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_a7172dd9.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_37e0b525.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_37af0ff0.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_0c5587bd.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_0b9a2467.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_20261118-210309_AI_Studio_8cf22b45.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "6e90ef6badb142ea859c04be0d61f7c4"
  }, {
    "url": "icon.svg",
    "revision": "da51899b20f58783dbdd7b834886f101"
  }, {
    "url": "pwa-192x192.png",
    "revision": "3d7499ea57ef3784d2fc4fd84cc53562"
  }, {
    "url": "pwa-512x512.png",
    "revision": "6471ba5875b590920f442a417a9ba1fe"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "d57c874e677d421d4f2d862438aef664"
  }, {
    "url": "manifest.webmanifest",
    "revision": "318189f99fa539834a1a830ead63660c"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
