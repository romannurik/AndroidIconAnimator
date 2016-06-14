module.exports.routeConfig = function($locationProvider, $routeProvider) {
  $locationProvider.html5Mode(true);

  $routeProvider
      .otherwise({
        templateUrl: 'pages/studio/studio.html'
      });
};

Object.assign(module.exports, {
  studio: () => `/`
});
