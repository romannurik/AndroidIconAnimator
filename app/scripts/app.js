/*
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

angular.module('AVDStudio', ['ngMaterial', 'ngRoute'])
    .config(require('./materialtheme'))
    .config(require('./icons'))
    .config(require('./routes').routeConfig);

// core app
angular.module('AVDStudio').controller('AppCtrl', class AppCtrl {
  constructor($scope) {}
});

// all components
require('../components/**/*.js', {mode: 'expand'});

// all pages
require('../pages/**/*.js', {mode: 'expand'});
