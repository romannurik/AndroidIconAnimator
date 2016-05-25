import {Artwork, ArtworkAnimation} from 'avdstudio/model';


const CHANGES_TAG = '$$studioState::CHANGES';


class StudioStateService {
  constructor($rootScope) {
    this.rootScope_ = $rootScope;
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
    this.broadcastChanges_({artwork: true});
  }

  get artworkAnimations() {
    return this.artworkAnimations_ || [];
  }

  set artworkAnimations(artworkAnimations) {
    this.artworkAnimations_ = artworkAnimations;
    if (artworkAnimations.indexOf(this.activeArtworkAnimation) < 0) {
      this.activeArtworkAnimation = artworkAnimations[0];
    }
    this.broadcastChanges_({artworkAnimations: true});
  }

  animChanged() {
    this.broadcastChanges_({artworkAnimations: true});
  }

  artworkChanged() {
    this.broadcastChanges_({artwork: true});
  }

  get activeArtworkAnimation() {
    return this.activeArtworkAnimation_
        || (this.artworkAnimations.length && this.artworkAnimations[0]);
  }

  set activeArtworkAnimation(activeArtworkAnimation) {
    this.activeArtworkAnimation_ = activeArtworkAnimation;
    this.broadcastChanges_({activeArtworkAnimation: true});
  }

  get activeTime() {
    return this.activeTime_;
  }

  set activeTime(activeTime) {
    this.activeTime_ = activeTime;
    this.broadcastChanges_({activeTime: true});
  }

  get selectedLayers() {
    return this.selectedLayers_ || [];
  }

  set selectedLayers(selectedLayers) {
    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer._selected = false);
    this.selectedLayers_ = selectedLayers;
    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer._selected = true);

    this.selectedAnimations_ && this.selectedAnimations_.forEach(anim => anim._selected = false);
    this.selectedAnimations_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimations: true});
  }

  toggleLayerSelected(layer) {
    let index = (this.selectedLayers_ || []).indexOf(layer);
    if (index < 0) {
      this.selectedLayers_.push(layer);
      layer._selected = true;
    } else {
      this.selectedLayers_.splice(index, 1);
      layer._selected = false;
    }

    this.selectedAnimations_ && this.selectedAnimations_.forEach(anim => anim._selected = false);
    this.selectedAnimations_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimations: true});
  }

  get selectedAnimations() {
    return this.selectedAnimations_ || [];
  }

  set selectedAnimations(selectedAnimations) {
    this.selectedAnimations_ && this.selectedAnimations_.forEach(anim => anim._selected = false);
    this.selectedAnimations_ = selectedAnimations;
    this.selectedAnimations_ && this.selectedAnimations_.forEach(anim => anim._selected = true);

    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer._selected = false);
    this.selectedLayers_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimations: true});
  }

  toggleAnimationSelected(animation) {
    let index = (this.selectedAnimations_ || []).indexOf(animation);
    if (index < 0) {
      this.selectedAnimations_.push(animation);
      animation._selected = true;
    } else {
      this.selectedAnimations_.splice(index, 1);
      animation._selected = false;
    }

    this.selectedLayers_ && this.selectedLayers_.forEach(layer => layer._selected = false);
    this.selectedLayers_ = null;

    this.broadcastChanges_({selectedLayers: true, selectedAnimations: true});
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
