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

const State = {
  NONE: 0,
  DRAGGING: 1,
  LOADING: 2,
};

class FileDropTargetController {
  constructor($scope, $element, $attrs) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.element_.addClass('file-drop-target');

    this.onDropFile_ = $attrs.fileDropTarget
        ? (fileInfo => $scope.$eval($attrs.fileDropTarget, {fileInfo}))
        : (() => {});

    this.state_ = State.NONE;

    // set up drag event listeners, with debouncing because dragging over/out of each child
    // triggers these events on the element

    let notDraggingTimeout_;

    let setDragging_ = dragging => {
      if (dragging) {
        // when moving from child to child, dragenter is sent before dragleave
        // on previous child
        window.setTimeout(() => {
          if (notDraggingTimeout_) {
            window.clearTimeout(notDraggingTimeout_);
            notDraggingTimeout_ = null;
          }
          this.setState_(State.DRAGGING);
        }, 0);
      } else {
        if (notDraggingTimeout_) {
          window.clearTimeout(notDraggingTimeout_);
        }
        notDraggingTimeout_ = window.setTimeout(() => this.setState_(State.NONE), 100);
      }
    };

    this.element_
        .on('dragenter', event => {
          event.preventDefault();
          setDragging_(true);
          return false;
        })
        .on('dragover', event => {
          event.preventDefault();
          event.originalEvent.dataTransfer.dropEffect = 'copy';
          return false;
        })
        .on('dragleave', event => {
          event.preventDefault();
          setDragging_(false);
          return false;
        })
        .on('drop', event => {
          event.preventDefault();
          this.setState_(State.NONE);
          this.handleDropFiles_(event.originalEvent.dataTransfer.files);
          return false;
        });
  }

  setState_(state) {
    this.state_ = state;
    this.element_.toggleClass('is-dragging-over', this.state_ === State.DRAGGING);
    this.element_.toggleClass('is-loading', this.state_ === State.LOADING);
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
      this.setState_(State.NONE);
      this.scope_.$apply(() => this.onDropFile_({
        textContent: event.target.result,
        name: file.name,
        type: file.type
      }));
    };

    fileReader.onerror = event => {
      this.setState_(State.NONE);
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
      this.setState_(State.NONE);
      alert('File read cancelled');
    };

    this.setState_(State.LOADING);
    fileReader.readAsText(file);
  }
}


angular.module('AVDStudio').directive('fileDropTarget', () => {
  return {
    restrict: 'A',
    controller: FileDropTargetController
  };
});
