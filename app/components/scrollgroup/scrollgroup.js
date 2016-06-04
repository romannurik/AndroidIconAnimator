let groups = {};

class ScrollGroupController {
  constructor($scope, $element, $attrs) {
    let scrollGroup = $attrs.scrollGroup || '';
    groups[scrollGroup] = groups[scrollGroup] || [];
    groups[scrollGroup].push($element);

    $element.on('scroll', () => {
      let scrollTop = $element.scrollTop();
      groups[scrollGroup].forEach(
          el => (el !== $element) ? el.scrollTop(scrollTop) : null);
    });

    $scope.$on('$destroy', () => {
      groups[scrollGroup].splice(groups[scrollGroup].indexOf($element), 1);
    });
  }
}


angular.module('AVDStudio').directive('scrollGroup', () => {
  return {
    restrict: 'A',
    scope: {},
    bindToController: true,
    controller: ScrollGroupController,
    controllerAs: 'ctrl'
  };
});
