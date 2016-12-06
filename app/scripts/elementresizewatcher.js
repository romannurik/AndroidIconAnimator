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

// Based on http://www.backalleycoder.com/2013/03/18/cross-browser-event-based-element-resize-detection/

export class ElementResizeWatcher {
  constructor(element, listener) {
    this.element_ = $(element);

    // create resize listener
    let rafHandle;

    this.onResize_ = event => {
      var el = event.target || event.srcElement;
      if (rafHandle) {
        el.cancelAnimationFrame(rafHandle);
      }

      rafHandle = el.requestAnimationFrame(() => listener());
    };

    // add listener
    if (getComputedStyle(this.element_.get(0)).position == 'static') {
      this.element_.css({position: 'relative'});
    }

    this.proxyElement_ = $('<object>')
        .css({
          display: 'block',
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: -1
        })
        .attr('type', 'text/html')
        .attr('data', 'about:blank')
        .on('load', () => {
          this.proxyDefaultView_ = this.proxyElement_.get(0).contentDocument.defaultView;
          this.proxyDefaultView_.addEventListener('resize', this.onResize_);
        })
        .appendTo(this.element_);
  }

  destroy() {
    if (this.proxyDefaultView_) {
      this.proxyDefaultView_.removeEventListener('resize', this.onResize_);
    }

    this.proxyElement_.remove();
  }
}
