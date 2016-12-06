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

class FileOpenHandlerController {
  constructor($scope, $element, $attrs) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.element_.addClass('file-open-proxy');

    this.onOpenFile_ = $attrs.fileOpenHandler
        ? (fileInfo => $scope.$eval($attrs.fileOpenHandler, {fileInfo}))
        : (() => {});
  }

  onLink() {
    this.inputElement_ = this.element_.find('input');
    this.inputElement_.on('change', () => {
      let files = this.inputElement_.get(0).files;
      if (files.length) {
        this.handleDropFiles_(files);
      }
    });
  }

  handleDropFiles_(fileList) {
    fileList = Array.from(fileList || []);
    fileList = fileList.filter(file =>
        (file.type == 'image/svg+xml' || file.type == 'application/json'
          || file.name.match(/\.iconanim$/)));
    if (!fileList.length) {
      return;
    }

    let file = fileList[0];

    let fileReader = new FileReader();

    fileReader.onload = event => {
      this.scope_.$apply(() => this.onOpenFile_({
        textContent: event.target.result,
        name: file.name,
        type: file.type
      }));
    };

    fileReader.onerror = event => {
      switch (event.target.error.code) {
        case event.target.error.NOT_FOUND_ERR:
          alert('File not found!');
          break;
        case event.target.error.NOT_READABLE_ERR:
          alert('File is not readable');
          break;
        case event.target.error.ABORT_ERR:
          break; // noop
        default:
          alert('An error occurred reading this file.');
      }
    };

    fileReader.onabort = function(e) {
      alert('File read cancelled');
    };

    fileReader.readAsText(file);
  }
}


angular.module('AVDStudio').directive('fileOpenHandler', () => {
  return {
    restrict: 'A',
    controller: FileOpenHandlerController,
    require: '^fileOpenHandler',
    link: ($element, $scope, $attrs, ctrl) => {
      ctrl.onLink($element);
    }
  };
});
