'use strict';

// Dependencies.
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const utils = require('../utils');
const { parallel } = require('async');
const { setWith, last, upperFirst, lowerFirst, get } = require('lodash');

module.exports = function() {
  this.hook = {};

  return Promise.all([
    new Promise((resolve, reject) => {
      const cwd = '';

      // Load configurations.
      glob('./node_modules/strapi-*', {
        ignore: [
          './node_modules/strapi-admin',
          './node_modules/strapi-utils',
          './node_modules/strapi-generate*',
          './node_modules/strapi-plugin-*',
          './node_modules/strapi-helper-*',
          './node_modules/strapi-middleware-*',
          './node_modules/strapi-upload-*'
        ]
      }, (err, files) => {
        if (err) {
          return reject(err);
        }

        mountHooks.call(this, files, cwd)(resolve, reject)
      });
    }),
    new Promise((resolve, reject) => {
      const cwd = 'hooks';

      // Load configurations.
      glob('./*', {
        cwd: path.resolve(this.config.appPath, 'hooks')
      }, (err, files) => {
        if (err) {
          return reject(err);
        }

        mountHooks.call(this, files, cwd)(resolve, reject);
      });
    }),
    new Promise((resolve, reject) => {
      const cwd = path.resolve(this.config.appPath, 'plugins');

      // Load configurations.
      glob('./*/hooks/*', {
        cwd
      }, (err, files) => {
        if (err) {
          return reject(err);
        }

        mountHooks.call(this, files, cwd, true)(resolve, reject);
      });
    })
  ]);
};

const mountHooks = function (files, cwd, isPlugin) {
  return (resolve, reject) =>
    parallel(
      files.map(p => cb => {
        const extractStr = p
          .split('/')
          .pop()
          .replace(/^strapi(-|\.)/, '')
          .split('-');

        const name = lowerFirst(
          extractStr.length === 1
            ? extractStr[0]
            : extractStr.map(p => upperFirst(p)).join('')
        );

        fs.readFile(path.resolve(this.config.appPath, cwd, p, 'package.json'), (err, content) => {
          try {
            const pkg = isPlugin ? {} : JSON.parse(content);

            this.hook[name] = {
              isPlugin,
              loaded: false,
              identity: name,
              dependencies: get(pkg, 'strapi.dependencies') || []
            };

            // Lazy loading.
            Object.defineProperty(this.hook[name], 'load', {
              configurable: false,
              enumerable: true,
              get: () => require(path.resolve(this.config.appPath, cwd, p))
            });

            cb();
          } catch (e) {
            cb(e);
          }

        });
      }),
      (err, results) => {
        if (err) {
          return reject(err);
        }

        resolve();
      }
    );
};
