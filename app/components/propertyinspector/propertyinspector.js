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

import {Artwork, Animation} from 'model';
import {Property, StubProperty, FractionProperty, IdProperty, EnumProperty} from 'model/properties';
import {ColorUtil} from 'ColorUtil';
import {ModelUtil} from 'ModelUtil';


class PropertyInspectorController {
  constructor($scope, $element, StudioStateService) {
    this.scope_ = $scope;
    this.element_ = $element;

    this.studioState_ = StudioStateService;
    this.studioState_.onChange((event, changes) => {
      if (changes.selection) {
        this.rebuildSelection_();
      }
    }, $scope);

    this.rebuildSelection_();
  }

  rebuildSelection_() {
    this.selectionInfo = null;
    if (this.studioState_.selectedLayers.length) {
      this.rebuildLayersSelection_();
    } else if (this.studioState_.selectedAnimationBlocks.length) {
      this.rebuildAnimationBlocksSelection_();
    } else if (this.studioState_.firstSelectedItem instanceof Animation) {
      this.rebuildAnimationsSelection_();
    }
  }

  androidToCssColor(val) {
    return ColorUtil.androidToCssColor(val);
  }

  get selectionDescription() {
    return this.selectionInfo && this.selectionInfo.description;
  }

  computeSharedPropertyNames_(items) {
    if (!items || !items.length) {
      return [];
    }

    let shared;
    items.forEach(item => {
      let names = Object.keys(item.inspectableProperties);
      if (!shared) {
        shared = names;
      } else {
        let namesSet = new Set(names);
        shared = shared.filter(n => namesSet.has(n));
      }
    });

    return shared;
  }

  rebuildLayersSelection_() {
    this.selectionInfo = {
      type: 'layers',
      inspectedProperties: []
    };

    if (this.studioState_.selection.length > 1) {
      // batch layer editing
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collection';
      this.selectionInfo.description = `${count} layers`;

      let layers = this.studioState_.selection;
      let sharedPropertyNames = this.computeSharedPropertyNames_(layers);
      sharedPropertyNames.forEach(propertyName => {
        let property = layers[0].inspectableProperties[propertyName];
        if (property instanceof IdProperty) {
          return;
        }

        this.selectionInfo.inspectedProperties.push(new InspectedProperty({
          get value() {
            return layers.reduce(
                (v, layer) => (v == layer[propertyName]) ? v : null,
                layers[0][propertyName]);
          },
          set value(val) {
            layers.forEach(layer => layer[propertyName] = val);
          },
          propertyName,
          property,
          onChange: () => {
            this.studioState_.animChanged();
            this.studioState_.artworkChanged();
          }
        }));
      });

    } else {
      // edit a single layer
      let layer = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = layer.typeIcon;
      Object.defineProperty(this.selectionInfo, 'description', {
        get: () => layer.id
      });
      Object.keys(layer.inspectableProperties).forEach(propertyName => {
        let self = this;
        let property = layer.inspectableProperties[propertyName];
        this.selectionInfo.inspectedProperties.push(new InspectedProperty({
          object: layer,
          propertyName,
          property,
          get value() {
            if (!self.studioState_.animationRenderer || layer === self.studioState_.artwork) {
              return layer[propertyName];
            }

            let renderedLayer = self.studioState_.animationRenderer
                .renderedArtwork.findLayerById(layer.id);
            return renderedLayer ? renderedLayer[propertyName] : null;
          },
          set value(value) {
            if (property instanceof IdProperty) {
              self.studioState_.updateLayerId(layer, value);
            } else {
              layer[propertyName] = value;
              self.studioState_.artworkChanged();
            }
          },
          transformEditedValue: (property instanceof IdProperty)
              ? enteredValue => this.studioState_
                    .getUniqueLayerId(IdProperty.sanitize(enteredValue), layer)
              : null,
          get editable() {
            return self.studioState_.animationRenderer
                ? !self.studioState_.animationRenderer
                    .getLayerPropertyState(layer.id, propertyName).activeBlock
                : true;
          }
        }));
      });
    }
  }

  rebuildAnimationBlocksSelection_() {
    this.selectionInfo = {
      type: 'animationBlocks',
      inspectedProperties: []
    };

    if (this.studioState_.selection.length > 1) {
      // batch animation block editing
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collection';
      this.selectionInfo.description = `${count} property animations`;

      let blocks = this.studioState_.selection;
      let sharedPropertyNames = this.computeSharedPropertyNames_(blocks);
      sharedPropertyNames.forEach(propertyName => {
        let property = blocks[0].inspectableProperties[propertyName];
        if (property instanceof StubProperty) {
          // fromValue and toValue only work when they're animating compatible property types
          let properties = blocks.map(block =>
              this.studioState_.artwork.findLayerById(block.layerId)
                  .inspectableProperties[block.propertyName]);
          let propertiesCompatible = properties.reduce(
              (c, prop) => c && prop.constructor === properties[0].constructor,
              true);
          if (!propertiesCompatible) {
            return;
          }
          property = properties[0];
        }
        this.selectionInfo.inspectedProperties.push(new InspectedProperty({
          get value() {
            return blocks.reduce(
                (v, block) => (v == block[propertyName]) ? v : null,
                blocks[0][propertyName]);
          },
          set value(val) {
            blocks.forEach(block => block[propertyName] = val);
          },
          propertyName,
          property,
          onChange: () => this.studioState_.animChanged()
        }));
      });

    } else {
      // edit a single animation block
      let block = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = 'animation_block';
      this.selectionInfo.description = `${block.propertyName}`;
      this.selectionInfo.subDescription = `for '${block.layerId}'`;
      Object.keys(block.inspectableProperties).forEach(propertyName => {
        let property = block.inspectableProperties[propertyName];
        if (property instanceof StubProperty) {
          property = this.studioState_.artwork.findLayerById(block.layerId)
              .inspectableProperties[block.propertyName];
        }
        this.selectionInfo.inspectedProperties.push(new InspectedProperty({
          object: block,
          propertyName,
          property,
          onChange: () => this.studioState_.animChanged()
        }));
      });
    }
  }

  rebuildAnimationsSelection_() {
    this.selectionInfo = {
      type: 'animations',
      inspectedProperties: []
    };

    if (this.studioState_.selection.length > 1) {
      // batch animation editing
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collection';
      this.selectionInfo.description = `${count} animations`;
      // TODO

    } else {
      // edit a single animation
      let animation = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = 'animation';
      Object.defineProperty(this.selectionInfo, 'description', {
        get: () => animation.id
      });
      Object.keys(animation.inspectableProperties).forEach(propertyName => {
        let property = animation.inspectableProperties[propertyName];
        this.selectionInfo.inspectedProperties.push(new InspectedProperty({
          object: animation,
          propertyName,
          transformEditedValue: (property instanceof IdProperty)
              ? enteredValue => this.studioState_
                    .getUniqueAnimationId(IdProperty.sanitize(enteredValue), animation)
              : null,
          property,
          onChange: () => this.studioState_.animChanged()
        }));
      });
    }
  }

  onValueEditorKeyDown(event, inspectedProperty) {
    switch (event.keyCode) {
      // up/down buttons
      case 38:
      case 40:
        inspectedProperty.resolveEnteredValue();
        let $target = $(event.target);
        let numberValue = Number($target.val());
        if (!isNaN(numberValue)) {
          let delta = (event.keyCode == 38) ? 1 : -1;

          if (inspectedProperty.property instanceof FractionProperty) {
            delta *= .1;
          }

          if (event.shiftKey) {
            delta *= 10;
          } else if (event.altKey) {
            delta /= 10;
          }

          numberValue += delta;
          inspectedProperty.property.trySetEditedValue(
              inspectedProperty, 'value', Number(numberValue.toFixed(6)));
          setTimeout(() => $target.get(0).select(), 0);
          return true;
        }
        break;
    }
  }
}


class InspectedProperty {
  constructor(delegate) {
    this.delegate = delegate;
    this.object = delegate.object;
    this.propertyName = delegate.propertyName;
    this.property = delegate.property;
    this.enteredValue_ = null;
  }

  get value() {
    return ('value' in this.delegate)
        ? this.delegate.value
        : this.object[this.propertyName];
  }

  set value(value) {
    ('value' in this.delegate)
        ? (this.delegate.value = value)
        : (this.object[this.propertyName] = value);
    if (this.delegate.onChange) {
      this.delegate.onChange();
    }
  }

  get typeName() {
    return this.property.constructor.name;
  }

  get editable() {
    return 'editable' in this.delegate ? this.delegate.editable : true;
  }

  get displayValue() {
    return this.property.displayValueForValue(this.value);
  }

  get editableValue() {
    return (this.enteredValue_ !== null)
        ? this.enteredValue_
        : this.property.getEditableValue(this, 'value');
  }

  set editableValue(enteredValue) {
    this.enteredValue_ = enteredValue;
    if (this.delegate.transformEditedValue) {
      enteredValue = this.delegate.transformEditedValue(enteredValue);
    }
    this.property.trySetEditedValue(this, 'value', enteredValue);
  }

  resolveEnteredValue() {
    this.enteredValue_ = null;
  }
}


angular.module('AVDStudio').directive('studioPropertyInspector', () => {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'components/propertyinspector/propertyinspector.html',
    replace: true,
    bindToController: true,
    controller: PropertyInspectorController,
    controllerAs: 'ctrl'
  };
});


// timeline grid
