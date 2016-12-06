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
    controller: ScrollGroupController
  };
});
