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

import {DragHelper} from 'draghelper';


class SplitterController {
  constructor($scope, $element, $attrs) {
    this.edge_ = $attrs.edge;
    this.min_ = Number($attrs.min) || 100;
    this.persistKey_ = $attrs.persistId ? `\$\$splitter::${$attrs.persistId}` : null;
    this.orientation_ = (this.edge_ == 'left' || this.edge_ == 'right')
        ? 'vertical'
        : 'horizontal';
    this.element_ = $element;
    this.parent_ = $element.parent();
    this.dragging_ = false;

    if (this.orientation_ == 'vertical') {
      this.sizeGetter_ = () => this.parent_.width();
      this.sizeSetter_ = size => this.parent_.width(size);
      this.clientXY_ = 'clientX';

    } else {
      this.sizeGetter_ = () => this.parent_.height();
      this.sizeSetter_ = size => this.parent_.height(size);
      this.clientXY_ = 'clientY';
    }

    this.addClasses_();
    this.setupEventListeners_();
    this.deserializeState_();
  }

  deserializeState_() {
    if (this.persistKey_ in localStorage) {
      this.setSize_(Number(localStorage[this.persistKey_]));
    }
  }

  addClasses_() {
    this.element_
        .addClass(`splt-${this.orientation_}`)
        .addClass(`splt-edge-${this.edge_}`);
  }

  setupEventListeners_() {
    this.element_.on('mousedown', event => {
      this.downXY_ = event[this.clientXY_];
      this.downSize_ = this.sizeGetter_();
      event.preventDefault();

      new DragHelper({
        downEvent: event,
        direction: (this.orientation_ == 'vertical') ? 'horizontal' : 'vertical',
        draggingCursor: (this.orientation_ == 'vertical') ? 'col-resize' : 'row-resize',

        onBeginDrag: event => this.element_.addClass('is-dragging'),
        onDrop: event => this.element_.removeClass('is-dragging'),
        onDrag: (event, delta) => {
          let sign = (this.edge_ == 'left' || this.edge_ == 'top') ? -1 : 1;
          this.setSize_(Math.max(this.min_,
              this.downSize_ + sign * delta[(this.orientation_ == 'vertical') ? 'x' : 'y']));
        }
      });
    });
  }

  setSize_(size) {
    if (this.persistKey_) {
      localStorage[this.persistKey_] = size;
    }
    this.sizeSetter_(size);
  }
}


angular.module('AVDStudio').directive('studioSplitter', () => {
  return {
    restrict: 'E',
    scope: {},
    template: '<div class="studio-splitter"></div>',
    replace: true,
    bindToController: true,
    controller: SplitterController,
    controllerAs: 'ctrl'
  };
});
