import {Artwork, Layer, LayerGroup, MaskLayer,
        Animation,
        Property, FractionProperty, IdProperty, EnumProperty} from 'avdstudio/model';
import {ColorUtil} from 'avdstudio/colorutil';
import {ModelUtil} from 'avdstudio/modelutil';


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

  rebuildLayersSelection_() {
    this.selectionInfo = {
      type: 'layers',
      inspectedProperties: []
    };

    if (this.studioState_.selection.length > 1) {
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collections';
      this.selectionInfo.description = `${count} layers`;

    } else {
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
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collections';
      this.selectionInfo.description = `${count} property animations`;

    } else {
      let block = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = 'animation_block';
      this.selectionInfo.description = `${block.propertyName}`;
      this.selectionInfo.subDescription = `for '${block.layerId}'`;
      Object.keys(block.inspectableProperties).forEach(propertyName => {
        let property = block.inspectableProperties[propertyName];
        if (property == 'auto') {
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
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collections';
      this.selectionInfo.description = `${count} animations`;

    } else {
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
