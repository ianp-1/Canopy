import { Composition } from 'remotion';
import { GradientVideo } from './GradientVideo';
import { ShowcaseVideo } from './ShowcaseVideo';
import { AnimatedIcon } from './AnimatedIcons';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GradientBackground"
        component={GradientVideo}
        durationInFrames={300} // 10 seconds loop at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition 
         id="ShowcaseVideo"
         component={ShowcaseVideo}
         durationInFrames={240}
         fps={30}
         width={1280}
         height={720}
      />
      <Composition
        id="AnimatedIcon"
        component={AnimatedIcon}
        durationInFrames={120}
        fps={30}
        width={128}
        height={128}
        defaultProps={{
             type: 'lightning'
        }}
      />
    </>
  );
};
