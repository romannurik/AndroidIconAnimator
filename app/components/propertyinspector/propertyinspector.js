import {Artwork, Layer, LayerGroup, MaskLayer, Animation, Property, EnumProperty} from 'avdstudio/model';
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

  rebuildLayersSelection_() {
    this.selectionInfo = {
      type: 'layers',
      properties: []
    };

    if (this.studioState_.selection.length > 1) {
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collections';
      this.selectionInfo.description = `${count} layers`;

    } else {
      let layer = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = (layer instanceof LayerGroup)
          ? 'folder_open'
          : ((layer instanceof MaskLayer) ? 'photo_size_select_large' : 'layers');
      this.selectionInfo.description = layer.id;
      Object.keys(layer.inspectableProperties).forEach(propertyName => {
        let self = this;
        this.selectionInfo.properties.push(new PropertyModelHelper({
          object: layer,
          propertyName,
          property: layer.inspectableProperties[propertyName],
          get value() {
            if (!self.studioState_.animationRenderer) {
              return layer[propertyName];
            }

            let renderedLayer = self.studioState_.animationRenderer
                .renderedArtwork.findLayerById(layer.id);
            return renderedLayer ? renderedLayer[propertyName] : null;
          },
          set value(value) {
            layer[propertyName] = value;
            self.studioState_.artworkChanged();
          },
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
      properties: []
    };

    if (this.studioState_.selection.length > 1) {
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collections';
      this.selectionInfo.description = `${count} property animations`;

    } else {
      let block = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = 'access_time';
      this.selectionInfo.description = `${block.propertyName}`;
      this.selectionInfo.subDescription = `for '${block.layerId}'`;
      Object.keys(block.inspectableProperties).forEach(p => {
        let self = this;
        let property = block.inspectableProperties[p];
        if (property == 'auto') {
          property = this.studioState_.artwork.findLayerById(block.layerId)
              .inspectableProperties[block.propertyName];
        }
        this.selectionInfo.properties.push(new PropertyModelHelper({
          object: block,
          propertyName: p,
          property,
          get value() {
            return block[p];
          },
          set value(value) {
            block[p] = value;
            self.studioState_.animChanged();
          },
          get editable() {
            return true;
          }
        }));
      });
    }
  }

  rebuildAnimationsSelection_() {
    this.selectionInfo = {
      type: 'animations',
      properties: []
    };

    if (this.studioState_.selection.length > 1) {
      let count = this.studioState_.selection.length;
      this.selectionInfo.multiple = true;
      this.selectionInfo.icon = 'collections';
      this.selectionInfo.description = `${count} animations`;

    } else {
      let animation = this.studioState_.firstSelectedItem;
      this.selectionInfo.icon = 'movie';
      this.selectionInfo.description = animation.id;
      Object.keys(animation.inspectableProperties).forEach(p => {
        let self = this;
        this.selectionInfo.properties.push(new PropertyModelHelper({
          object: animation,
          propertyName: p,
          property: animation.inspectableProperties[p],
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
    this.property_ = opts.property;
    this.enteredValue_ = null;
  }

  get name() {
    return this.propertyName_;
  }

  get property() {
    return this.property_;
  }

  get typeName() {
    return this.property_.constructor.name;
  }

  get value() {
    return this.property_.getValueForObject(this.opts_, 'value');
  }

  set value(enteredValue) {
    this.property_.setValueOnObject(this.opts_, 'value', enteredValue);
  }

  get editable() {
    return this.opts_.editable;
  }

  get displayValue() {
    return (this.enteredValue_ !== null)
        ? this.enteredValue_
        : this.property_.displayValueForValue(this.value);
  }

  set displayValue(enteredValue) {
    this.enteredValue_ = enteredValue;
    let value = this.property_.parse(enteredValue);
    if (value !== null) {
      this.value = value;
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
