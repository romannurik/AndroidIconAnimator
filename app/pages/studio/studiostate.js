import {Artwork, Animation} from 'avdstudio/model';
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
    return this.animations_ || [];
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

  get selectedLayers() {
    return this.selectedLayers_ || [];
  }

  set selectedLayers(selectedLayers) {
    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer.selected_ = false);
    this.selectedLayers_ = selectedLayers;
    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer.selected_ = true);

    this.selectedAnimationBlocks_
        && this.selectedAnimationBlocks_.forEach(anim => anim.selected_ = false);
    this.selectedAnimationBlocks_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimationBlocks: true});
  }

  toggleLayerSelected(layer) {
    let index = (this.selectedLayers_ || []).indexOf(layer);
    if (index < 0) {
      this.selectedLayers_.push(layer);
      layer.selected_ = true;
    } else {
      this.selectedLayers_.splice(index, 1);
      layer.selected_ = false;
    }

    this.selectedAnimationBlocks_
        && this.selectedAnimationBlocks_.forEach(anim => anim.selected_ = false);
    this.selectedAnimationBlocks_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimationBlocks: true});
  }

  get selectedAnimationBlocks() {
    return this.selectedAnimationBlocks_ || [];
  }

  set selectedAnimationBlocks(selectedAnimationBlocks) {
    this.selectedAnimationBlocks_
        && this.selectedAnimationBlocks_.forEach(anim => anim.selected_ = false);
    this.selectedAnimationBlocks_ = selectedAnimationBlocks;
    this.selectedAnimationBlocks_
        && this.selectedAnimationBlocks_.forEach(anim => anim.selected_ = true);

    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer.selected_ = false);
    this.selectedLayers_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimationBlocks: true});
  }

  toggleAnimationBlockSelected(animation) {
    let index = (this.selectedAnimationBlocks_ || []).indexOf(animation);
    if (index < 0) {
      this.selectedAnimationBlocks_.push(animation);
      animation.selected_ = true;
    } else {
      this.selectedAnimationBlocks_.splice(index, 1);
      animation.selected_ = false;
    }

    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer.selected_ = false);
    this.selectedLayers_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimationBlocks: true});
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
