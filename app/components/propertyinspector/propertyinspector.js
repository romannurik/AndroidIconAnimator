import {Artwork, Layer, LayerGroup, MaskLayer, PropertyType} from 'avdstudio/model';
import {ColorUtil} from 'avdstudio/colorutil';
import {ModelUtil} from 'avdstudio/modelutil';


class PropertyInspectorController {
  constructor($scope, $element, StudioStateService) {
    this.scope_ = $scope;
    this.element_ = $element;

    this.studioState_ = StudioStateService;
    this.studioState_.onChange((event, changes) => {
      if (changes.selectedLayers || changes.selectedAnimationBlocks) {
        this.rebuildSelection_();
      }
    }, $scope);

    this.rebuildSelection_();
  }

  get selectedLayers() {
    return this.studioState_.selectedLayers;
  }

  get selectedAnimationBlocks() {
    return this.studioState_.selectedAnimationBlocks;
  }

  rebuildSelection_() {
    this.selection = null;
    if (this.studioState_.selectedLayers.length) {
      this.rebuildLayersSelection_();
    } else if (this.studioState_.selectedAnimationBlocks.length) {
      this.rebuildAnimationsSelection_();
    }
  }

  androidToCssColor(val) {
    return ColorUtil.androidToCssColor(val);
  }

  rebuildLayersSelection_() {
    this.selection = {
      type: 'layers',
      properties: []
    };

    if (this.studioState_.selectedLayers.length > 1) {
      let count = this.studioState_.selectedLayers.length;
      this.selection.multiple = true;
      this.selection.icon = 'collections';
      this.selection.description = `${count} items`;

    } else {
      let layer = this.studioState_.selectedLayers[0];
      this.selection.icon = (layer instanceof LayerGroup)
          ? 'folder_open'
          : ((layer instanceof MaskLayer) ? 'photo_size_select_large' : 'layers');
      this.selection.description = layer.id;
      Object.keys(layer.inspectableProperties).forEach(propertyName => {
        let self = this;
        this.selection.properties.push(new PropertyModelHelper({
          object: layer,
          propertyName,
          propertyType: layer.inspectableProperties[propertyName],
          get value() {
            let renderedLayer = self.studioState_.animationRenderer
                .renderedArtwork.findLayerById(layer.id);
            return renderedLayer ? renderedLayer[propertyName] : null;
          },
          set value(value) {
            layer[propertyName] = value;
            self.studioState_.artworkChanged();
          },
          get editable() {
            return !self.studioState_.animationRenderer
                .getLayerPropertyState(layer.id, propertyName).activeAnimation;
          }
        }));
      });
    }
  }

  rebuildAnimationsSelection_() {
    this.selection = {
      type: 'animations',
      properties: []
    };

    if (this.studioState_.selectedAnimationBlocks.length > 1) {
      let count = this.studioState_.selectedAnimationBlocks.length;
      this.selection.multiple = true;
      this.selection.icon = 'collections';
      this.selection.description = `${count} property animations`;

    } else {
      let animation = this.studioState_.selectedAnimationBlocks[0];
      this.selection.icon = 'access_time';
      this.selection.description = `${animation.propertyName}`;
      this.selection.subDescription = `for '${animation.layerId}'`;
      Object.keys(animation.inspectableProperties).forEach(p => {
        let self = this;
        let propertyType = animation.inspectableProperties[p];
        if (propertyType == 'auto') {
          propertyType = this.studioState_.artwork.findLayerById(animation.layerId)
              .inspectableProperties[animation.propertyName];
        }
        this.selection.properties.push(new PropertyModelHelper({
          object: animation,
          propertyName: p,
          propertyType,
          get value() {
            return animation[p];
          },
          set value(value) {
            animation[p] = value;
            self.studioState_.animChanged();
          },
          get editable() {
            return true;
          }
        }));
      });
    }
  }

  onValueEditorKeyDown(event, prop) {
    switch (event.keyCode) {
      // up/down buttons
      case 38:
      case 40:
        let $target = $(event.target);
        let numberValue = Number($target.val());
        if (!isNaN(numberValue)) {
          let delta = (event.keyCode == 38) ? 1 : -1;

          if (prop.type == 'fraction') {
            delta *= .1;
          }

          if (event.shiftKey) {
            delta *= 10;
          } else if (event.altKey) {
            delta /= 10;
          }

          numberValue += delta;
          prop.value = Number(numberValue.toFixed(6));
          setTimeout(() => $target.get(0).select(), 0);
          return true;
        }
        break;
    }
  }
}


class PropertyModelHelper {
  constructor(opts) {
    this.opts_ = opts;
    this.object_ = opts.object;
    this.propertyName_ = opts.propertyName;
    this.propertyType_ = opts.propertyType;
    this.propertyTypeObj_ = PropertyType.get(opts.propertyType);
    this.enteredValue_ = null;
  }

  get name() {
    return this.propertyName_;
  }

  get type() {
    return this.propertyType_;
  }

  get value() {
    return (this.enteredValue_ !== null)
        ? this.enteredValue_
        : this.opts_.value;
  }

  set value(enteredValue) {
    if (this.propertyType_.indexOf('enum') >= 0) {
      this.opts_.value = enteredValue;
    } else {
      this.enteredValue_ = enteredValue;
      let value = this.propertyTypeObj_.parse(enteredValue);
      if (value !== null) {
        this.opts_.value = value;
      }
    }
  }

  get editable() {
    return this.opts_.editable;
  }

  get enumOptions() {
    return this.propertyTypeObj_.options;
  }

  enumDisplayValueForValue(value) {
    return this.propertyTypeObj_.displayValueForValue(value);
  }

  get displayValue() {
    if (this.propertyType_.indexOf('enum') >= 0) {
      return this.propertyTypeObj_.displayValueForValue(this.value);
    } else {
      let value = this.value;
      if (typeof value === 'number') {
        return (Number.isInteger(value)
              ? value.toString()
              : Number(value.toFixed(3)).toString())
            .replace(/-/g, '\u2212');
      }
      return value;
    }
  }

  destroyEnteredValue() {
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
