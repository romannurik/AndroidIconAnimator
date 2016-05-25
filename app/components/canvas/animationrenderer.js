import {Artwork, Layer, LayerGroup, ArtworkAnimation, LayerAnimation} from 'avdstudio/model';
import ModelUtil from 'avdstudio/model_util';


module.exports = class AnimationRenderer {
  constructor(artwork, artworkAnimation) {
    this.originalArtwork = artwork;
    this.artworkAnimation = artworkAnimation;
    this.renderedArtwork = new Artwork(artwork);

    this.animDataByLayer = ModelUtil.getOrderedPropertyAnimationsByLayerId(artworkAnimation);

    Object.keys(this.animDataByLayer).forEach(layerId => {
      this.animDataByLayer[layerId] = {
        originalLayer: this.originalArtwork.findLayerById(layerId),
        renderedLayer: this.renderedArtwork.findLayerById(layerId),
        orderedPropertyAnimations: this.animDataByLayer[layerId]
      };
    });
  }

  setAnimationTime(time) {
    for (let layerId in this.animDataByLayer) {
      let animData = this.animDataByLayer[layerId];
      for (let propertyName in animData.orderedPropertyAnimations) {
        let propertyAnimations = animData.orderedPropertyAnimations[propertyName];

        // compute rendered value at given time
        let value = animData.originalLayer[propertyName];
        for (let i = 0; i < propertyAnimations.length; ++i) {
          let anim = propertyAnimations[i];
          if (time < anim.startTime) {
            break;
          } else if (time < anim.endTime) {
            // TODO: interpolate colors and such
            let fromValue = ('fromValue' in anim) ? anim.fromValue : value;
            let f = (time - anim.startTime) / (anim.endTime - anim.startTime);
            f = anim.interpolator(f);
            value = fromValue + (anim.toValue - fromValue) * f;
            break;
          }

          value = anim.toValue;
        }

        animData.renderedLayer[propertyName] = value;
      }
    }

    this.animTime = time;
  }
}
