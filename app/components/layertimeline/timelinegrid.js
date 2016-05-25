const TIMELINE_ANIMATION_PADDING = 20; // 20px


angular.module('AVDStudio').directive('studioTimelineGrid', function() {
  return {
    restrict: 'E',
    scope: {
      isActive: '=',
      activeTime: '=',
      artworkAnimation: '=',
      onScrub: '&'
    },
    template: '<canvas></canvas>',
    replace: true,
    require: '^studioLayerTimeline',
    link: function(scope, element, attrs, layerTimelineCtrl) {
      let $canvas = element;
      let canvas = $canvas.get(0);

      let isHeader = 'isHeader' in attrs;

      scope.$watch(() => {
        scope.redraw_();
      });

      if ('onScrub' in attrs) {
        var scrubbing = false;
        let handleX_ = x => {
          x -= $canvas.offset().left;
          let time = (x - TIMELINE_ANIMATION_PADDING)
              / ($canvas.width() - TIMELINE_ANIMATION_PADDING * 2)
              * scope.artworkAnimation.duration;
          time = Math.max(0, Math.min(time, scope.artworkAnimation.duration));
          scope.onScrub({ artworkAnimation: scope.artworkAnimation, time });
        };

        $canvas
            .on('mousedown', event => {
              scrubbing = true;
              handleX_(event.clientX);
            })
            .on('mouseup', event => {
              scrubbing = false;
            });

        let mouseMoveHandler_ = event => {
          if (scrubbing) {
            handleX_(event.clientX);
          }
        };

        let mouseUpHandler_ = event => {
          scrubbing = false;
        };

        $(window)
            .on('mousemove', mouseMoveHandler_)
            .on('mouseup', mouseUpHandler_);
        scope.$on('$destroy', () =>
            $(window)
                .off('mousemove', mouseMoveHandler_)
                .off('mouseup', mouseUpHandler_));
      }

      scope.redraw_ = () => {
        let width = $canvas.width();
        let height = $canvas.height();
        let horizZoom = layerTimelineCtrl.horizZoom;
        $canvas.attr('width', width * window.devicePixelRatio);
        $canvas.attr('height', isHeader ? height * window.devicePixelRatio : 1);

        let ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.translate(TIMELINE_ANIMATION_PADDING, 0);

        // compute grid spacing
        let spacingMs = 1;
        while ((spacingMs * horizZoom) < 40) { // minimum grid spacing
          spacingMs *= 10;
        }

        let spacingPx = spacingMs * horizZoom;

        if (isHeader) {
          // text labels
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '10px Roboto';
          for (let x = 0, t = 0; x <= width; x += spacingPx, t += spacingMs) {
            //ctx.fillRect(x - 0.5, 0, 1, height);
            ctx.fillText(`${t / 1000}s`, x, height / 2);
          }

          if (scope.isActive) {
            ctx.fillStyle = 'rgba(244, 67, 54, .7)';
            ctx.beginPath();
            ctx.arc(scope.activeTime * horizZoom, height / 2, 4, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();
            ctx.fillRect(scope.activeTime * horizZoom - 1, height / 2 + 4, 2, height);
          }

        } else {
          // grid lines
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          for (let x = spacingPx; x < width - TIMELINE_ANIMATION_PADDING * 2; x += spacingPx) {
            ctx.fillRect(x - 0.5, 0, 1, 1);
          }

          if (scope.isActive) {
            ctx.fillStyle = 'rgba(244, 67, 54, .7)';
            ctx.fillRect(scope.activeTime * horizZoom - 1, 0, 2, 1);
          }
        }


      }

    }
  };
});
