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

import {Property} from './Property';

export class EnumProperty extends Property {
  constructor(options, extra) {
    super();
    this.optionsByValue_ = {};
    this.options_ = (options || []).map(option => {
      let newOption = {};
      if (typeof option === 'string') {
        newOption = {
          value: option,
          label: option
        };
        option = newOption;
      }

      if (!('label' in option)) {
        option.label = option.value;
      }

      this.optionsByValue_[option.value] = option;
      return option;
    });

    extra = extra || {};
    if (extra.storeEntireOption) {
      this.storeEntireOption = extra.storeEntireOption;
    }
  }

  getter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    return obj[backingPropertyName];
  }

  setter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;

    obj[backingPropertyName] = this.storeEntireOption
        ? this.getOptionForValue_(value)
        : this.getOptionForValue_(value).value;
  }

  getOptionForValue_(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return this.optionsByValue_[value];
    } else if ('value' in value) {
      return value;
    }

    return null;
  }

  displayValueForValue(value) {
    if (!value) {
      return '';
    }

    return this.getOptionForValue_(value).label;
  }

  get options() {
    return this.options_;
  }
}
