import {Artwork, Animation, AnimationBlock, BaseLayer} from 'avdstudio/model';
import {AnimationRenderer} from 'avdstudio/animationrenderer';


const CHANGES_TAG = '$$studioState::CHANGES';


class StudioStateService {
  constructor($rootScope) {
    this.rootScope_ = $rootScope;
    this.rebuildRenderer_();
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
    this.rebuildRenderer_();
    this.broadcastChanges_({animations: true});
  }

  artworkChanged() {
    this.rebuildRenderer_();
    this.broadcastChanges_({artwork: true});
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
    this.animationRenderer_.setAnimationTime(activeTime);
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

  makeNewAnimationId() {
    let n = 1;
    let id_ = () => `anim_${n}`;
    while (this.animations.reduce((a, b) => a || b.id == id_(), false)) {
      ++n;
    }
    return id_();
  }

  deleteLayers(layersToDelete) {
    if (!Array.isArray(layersToDelete)) {
      layersToDelete = [layersToDelete];
    }

    let deleteAnimationsForLayer_ = layer => {
      layer.walk(layer => {
        this.animations.forEach(animation => {
          animation.blocks = animation.blocks.filter(layerAnim => layerAnim.layerId != layer.id);
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

  makeNewLayerId(type) {
    let n = 1;
    let id_ = () => `${type}_${n}`;
    while (this.artwork.findLayerById(id_())) {
      ++n;
    }
    return id_();
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
}


angular.module('AVDStudio').service('StudioStateService', StudioStateService);
