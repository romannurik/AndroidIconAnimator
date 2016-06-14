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
