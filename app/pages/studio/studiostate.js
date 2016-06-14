import {Artwork, Animation, AnimationBlock, BaseLayer} from 'model';
import {AnimationRenderer} from 'animationrenderer';
import {AvdSerializer} from 'avdserializer';
import {ModelUtil} from 'modelutil';
import {default as zip} from 'zipjs-browserify';


const CHANGES_TAG = '$$studioState::CHANGES';


class StudioStateService {
  constructor($rootScope) {
    this.rootScope_ = $rootScope;
    this.rebuildRenderer_();
  }

  load(obj) {
    this.artwork_ = obj.artwork;
    this.animations_ = obj.animations || [];
    this.activeTime_ = 0;
    this.playing_ = false;
    this.selection_ = null;

    this.activeAnimation_ = this.animations_.length ? this.animations_[0] : null;

    this.rebuildRenderer_();

    this.broadcastChanges_({
      artwork: true,
      animations: true,
      selection: true,
      activeTime: true,
      playing: true
    });

    this.dirty_ = false;
  }

  get playbackSpeed() {
    return this.playbackSpeed_ || 1;
  }

  set playbackSpeed(speed) {
    this.playbackSpeed_ = speed;
  }

  get playing() {
    return this.playing_;
  }

  set playing(playing) {
    this.playing_ = playing;
    this.broadcastChanges_({playing: true});
  }

  get artwork() {
    return this.artwork_;
  }

  set artwork(artwork) {
    this.artwork_ = artwork;
    this.artworkChanged();
  }

  get animations() {
    return (this.animations_ = this.animations_ || []);
  }

  set animations(animations) {
    this.animations_ = animations;
    if (animations.indexOf(this.activeAnimation) < 0) {
      this.activeAnimation = animations[0];
    }
    this.animChanged();
  }

  animChanged() {
    this.dirty_ = true;
    this.rebuildRenderer_();
    this.broadcastChanges_({animations: true});

    // console.clear();
    // console.log(AvdSerializer.artworkAnimationToAvdXmlString(this.artwork, this.animations[0]));
  }

  artworkChanged() {
    this.dirty_ = true;
    this.rebuildRenderer_();
    this.broadcastChanges_({artwork: true});
  }

  get dirty() {
    return !!this.dirty_;
  }

  set dirty(dirty) {
    this.dirty_ = dirty;
  }

  get animationRenderer() {
    return this.animationRenderer_;
  }

  get activeAnimation() {
    return this.activeAnimation_ || (this.animations.length && this.animations[0]);
  }

  set activeAnimation(activeAnimation) {
    if (this.activeAnimation_ === activeAnimation) {
      return;
    }

    this.activeAnimation_ = activeAnimation;
    this.rebuildRenderer_();
    this.broadcastChanges_({activeAnimation: true});
  }

  rebuildRenderer_() {
    this.animationRenderer_ = null;
    if (this.activeAnimation) {
      this.animationRenderer_ = new AnimationRenderer(
          this.artwork_,
          this.activeAnimation);
      this.animationRenderer_.setAnimationTime(this.activeTime_);
    }
  }

  get activeTime() {
    return this.activeTime_ || 0;
  }

  set activeTime(activeTime) {
    this.activeTime_ = activeTime;
    if (this.animationRenderer_) {
      this.animationRenderer_.setAnimationTime(activeTime);
    }
    this.broadcastChanges_({activeTime: true});
  }

  getSelectionByType_(type) {
    return (this.selection_ && this.selection_.length && this.selection_[0] instanceof type)
        ? this.selection_ : [];
  }

  get selectedLayers() {
    return this.getSelectionByType_(BaseLayer);
  }

  get selectedAnimationBlocks() {
    return this.getSelectionByType_(AnimationBlock);
  }

  get selectedAnimations() {
    return this.getSelectionByType_(Animation);
  }

  get firstSelectedItem() {
    return ((this.selection_ || []).length > 0) ? this.selection_[0] : null;
  }

  get isMultipleSelection() {
    return this.selection_ ? !!(this.selection_.length > 1) : false;
  }

  get selection() {
    return this.selection_ || [];
  }

  set selection(selection) {
    this.selection_ = this.selection_ || [];
    this.selection_.forEach(item => delete item.selected_);
    this.selection_ = selection ? selection.slice() : [];
    this.selection_.forEach(item => item.selected_ = true);
    this.broadcastChanges_({selection: true});
  }

  areItemsMultiselectCompatible_(item1, item2) {
    return !!(!item1 || !item2
        || item1.constructor === item2.constructor
        || item1 instanceof BaseLayer && item2 instanceof BaseLayer);
  }

  selectItem(item) {
    this.toggleSelected(item, true);
  }

  deselectItem(item) {
    this.toggleSelected(item, false);
  }

  toggleSelected(item, select) {
    if (!item) {
      return;
    }

    if (select === undefined) {
      select = !item.selected_;
    }

    if (!!item.selected_ == select) {
      return;
    }

    this.selection_ = this.selection_ || [];

    if (select) {
      // ensure only one type of thing is selected
      if (this.areItemsMultiselectCompatible_(this.firstSelectedItem, item)) {
        // add this item to the existing selection
        this.selection_.push(item);
        item.selected_ = true;
      } else {
        // reset the selection
        this.selection = [item];
      }
    } else {
      // simply toggle this item being selected
      let index = this.selection_.indexOf(item);
      if (index >= 0) {
        this.selection_.splice(index, 1);
        delete item.selected_;
      }
    }

    this.broadcastChanges_({selection: true});
  }

  deleteLayers(layersToDelete) {
    if (!Array.isArray(layersToDelete)) {
      layersToDelete = [layersToDelete];
    }

    let deleteAnimationsForLayer_ = layer => {
      layer.walk(layer => {
        this.animations.forEach(animation => {
          animation.blocks = animation.blocks.filter(block => block.layerId != layer.id);
        });
      });
    };

    let visit_ = layerGroup => {
      for (let i = layerGroup.layers.length - 1; i >= 0; --i) {
        let layer = layerGroup.layers[i];
        if (layersToDelete.indexOf(layer) >= 0) {
          deleteAnimationsForLayer_(layer);
          layerGroup.layers.splice(i, 1);
        } else if (layer.layers) {
          visit_(layer);
        }
      }
    };

    visit_(this.artwork);
    this.artworkChanged();
    this.animChanged();
  }

  updateLayerId(layer, newId) {
    let oldId = layer.id;
    if (oldId == newId) {
      return;
    }

    this.animations.forEach(animation => animation.blocks.forEach(block => {
      if (block.layerId == oldId) {
        block.layerId = newId;
      }
    }));
    layer.id = newId;

    this.artworkChanged();
    this.animChanged();
  }

  getUniqueAnimationId(prefix, targetAnimation = null) {
    return ModelUtil.getUniqueId({
      prefix: prefix || 'anim',
      objectById: id => this.animations.reduce((a, b) => a || (b.id == id), false),
      skipObject: targetAnimation
    });
  }

  getUniqueLayerId(prefix, targetLayer = null) {
    return ModelUtil.getUniqueId({
      prefix: prefix || (targetLayer ? targetLayer.typeIdPrefix : 'layer'),
      objectById: id => this.artwork.findLayerById(id),
      skipObject: targetLayer
    });
  }

  broadcastChanges_(changes) {
    this.rootScope_.$emit(CHANGES_TAG, changes);
  }

  onChange(fn, $scope) {
    let watcher = this.rootScope_.$on(CHANGES_TAG, function() {
      window.setTimeout(() => $scope.$apply(() => fn.apply(this, arguments)), 0);
    });
    $scope.$on('$destroy', () => watcher());
    return watcher;
  }

  downloadFile_(content, filename) {
    let anchor = $('<a>').hide().appendTo(document.body);
    let blob = content;
    if (!(content instanceof Blob)) {
      blob = new Blob([content], {type: 'octet/stream'});
    }
    let url = window.URL.createObjectURL(blob);
    anchor.attr({
      href: url,
      download: filename
    });
    anchor.get(0).click();
    window.URL.revokeObjectURL(url);
  }

  exportJSON() {
    let jsonStr = JSON.stringify({
      artwork: this.artwork.toJSON(),
      animations: this.animations.map(anim => anim.toJSON())
    }, null, 2);
    this.downloadFile_(jsonStr, `${this.artwork.id}.json`);
    this.dirty_ = false;
  }

  exportVectorDrawable() {
    let xmlStr = AvdSerializer.artworkToVectorDrawableXmlString(this.artwork);
    this.downloadFile_(xmlStr, `${this.artwork.id}.xml`);
  }

  exportAVDs() {
    if (this.animations.length) {
      let exportedAnimations = this.animations.map(animation => ({
        animation,
        filename: `avd_${this.artwork.id}_${animation.id}.xml`,
        xmlStr: AvdSerializer.artworkAnimationToAvdXmlString(this.artwork, animation)
      }));

      if (exportedAnimations.length == 1) {
        // download a single XML
        this.downloadFile_(exportedAnimations[0].xmlStr, exportedAnimations[0].filename);
      } else {
        // download a ZIP
        zip.createWriter(new zip.BlobWriter(), writer => {
          let i = -1;
          let next_ = () => {
            ++i;
            if (i >= exportedAnimations.length) {
              // close
              writer.close(blob => this.downloadFile_(blob, `avd_${this.artwork.id}.zip`));
            } else {
              // add next file
              let exportedAnimation = exportedAnimations[i];
              writer.add(
                  exportedAnimation.filename,
                  new zip.TextReader(exportedAnimation.xmlStr),
                  next_);
            }
          };
          next_();
        }, error => console.error(error));
      }
    }
  }
}


angular.module('AVDStudio').service('StudioStateService', StudioStateService);
