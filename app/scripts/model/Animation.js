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

import {Property, IdProperty, NumberProperty} from './properties';

import {AnimationBlock} from './AnimationBlock';

/**
 * An animation represents a collection of layer property tweens for a given artwork.
 */
@Property.register([
  {name: 'id', property: new IdProperty()},
  {name: 'duration', property: new NumberProperty({min:100, max:60000})}
])
export class Animation {
  constructor(obj = {}) {
    this.id = obj.id || null;
    this.blocks = (obj.blocks || []).map(obj => new AnimationBlock(obj));
    this.duration = obj.duration || 100;
  }

  get blocks() {
    return this.blocks_ || [];
  }

  set blocks(blocks) {
    this.blocks_ = blocks;
    this.blocks_.forEach(block => block.parent = this);
  }

  get typeString() {
    return 'animation';
  }

  get typeIdPrefix() {
    return 'anim';
  }

  get typeIcon() {
    return 'animation';
  }

  toJSON() {
    return {
      id: this.id,
      duration: this.duration,
      blocks: this.blocks.map(block => block.toJSON())
    };
  }
}
