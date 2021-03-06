import { Component, h } from "preact";

// Imports
import { AudioNodeInstance, IAudioNodeInstance } from '../util/audioNode';
import MixerChannel from './mixer-channel';

/**
 * Initializes an object which will hold values for interfacing
 * with an audio node.
 * 
 * @param {number} channelNumber -> what to call a channel (used for html)
 * @param {string} name -> this will be how we call the channel in code
 * @returns {object} object which contains channel info
 */
const channelFactory = (channelNumber: number, name: string) => {
  return {
    id: `ch-${channelNumber}`,
    name,
    audioAttrs: {
      volume: .2,
      muted: true
    },
    node: null
  }
}

/**
 * Factory function for producing default Audio Node Settings 
 * @param {AudioContext} audioContext -> current audion context, hosted as class attribute
 * @param {string} waveType -> one of four (sine, triangle, square, saw)
 * @param {number} initFreq -> initial frequency
 * 
 * @returns {object} This object contains an audioNode instance used
 * for initialization.
 */
const defaultAudioNodeSettings = (
  audioContext: AudioContext, 
  waveType: OscillatorType,
  initFreq: number
): IAudioNodeInstance => {
  return {
    audioCtx: audioContext,
    waveType,
    maxVolume: 0.2 * 0.2, // Used for initial value as well
    currFreq: initFreq
  }
}

export default class AudioMixer extends Component<any, any> {
  
  // We don't want this to be in the typical 'state'
  // due to we don't want it to be mutated after it's assigned
  public audioCtx: any; 

  public channelDefaults: any = {
    volRangeStep: 0.01,
    bgRgba: {
      r: 255,
      g: 161,
      b: 68,
      a: 1
    }
  }

  // Transfer to inherit from parent component?
  public sinKey = '0-160-210';
  public triKey = '0-160-70';
  public squKey = '210-0-0';
  public sawKey = '240-70-130';

  public channels: any = {
    [this.sinKey]: channelFactory(0, 'sine'),
    [this.triKey]: channelFactory(1, 'triangle'),
    [this.squKey]: channelFactory(2, 'square'),
    [this.sawKey]: channelFactory(3, 'sawtooth'),
  };

  public addNodeToChannel(channel: string, initFreq: number) {
    const ch = this.channels[channel];
    console.log('Adding:', ch.name);
    ch.node = AudioNodeInstance(
      defaultAudioNodeSettings(
        this.audioCtx,
        ch.name as OscillatorType,
        initFreq
      )
    );
  }

  public muteChannelNodes = (channel: string) => {
    // Audio attrs is for reference
    this.channels[channel].audioAttrs.muted = true;
    this.channels[channel].node.mute();
  }

  public unmuteChannelNodes = (channel: string) => {
    // Audio attrs is for reference
    this.channels[channel].audioAttrs.muted = false;
    this.channels[channel].node.unmute();
  }

  public updateChannelVol = (channel: string, newVolume: number) => {
    this.channels[channel].audioAttrs.volume = newVolume;
    this.channels[channel].node.updateVolume(newVolume, this.audioCtx.currentTime);
  }

  public updateNodeFreq = (freqData: any) => {
    // Grab the sent color from each frequency and funnel into
    // updating the oscillator node
    Object.entries(freqData).forEach(([ color, freq ]) => {
      if(
          this.channels[color].node
          && freq
          && typeof freq === 'number'
        ){
         this.channels[color].node.updateFreq(freq, this.audioCtx.currentTime);
      }
    })
  }

  public startOscNodes = () => {
    // Chrome by default suspends auto addded
    // audio context nodes, so we resume
    // once we get input from the user
    if (this.audioCtx.state === 'suspended') {
      console.log('Resuming...');
      this.audioCtx.resume();
    }
    Object.values(this.channels).forEach(({ node, audioAttrs }: any) => {
      if(!node || node.started()){
        return;
      }
      node.start();
      if(!audioAttrs.muted) {
         return; 
      }
      node.mute();
    });
  }

  // This fuction is mainly implemented as a
  // 'message broker' for incoming event messages
  public decideAction = (ev: any) => {
    const { action, data }: 
      { 
        action: string, 
        data: any
      } = ev;
      switch(action) {
        case 'INIT_OSC':
          this.startOscNodes();
          break;
        case 'ADD_OSC':
          // Duck type as a backup
          this.addNodeToChannel(data.channel || 'sine', data.initFreq || 440);
          break;
        case 'UPDATE_OSCFRQ':
          this.updateNodeFreq(data);
          break;
        case 'CTX_SUSPEND':
            this.audioCtx.suspend();
          break;
        default:
          console.log(`Mixer: ${action} action not specified`);
          console.log(ev);
          return;
      }

  }

  public componentDidMount() {
    const { subFn, audioContext }: any = this.props;
    this.audioCtx = audioContext;
    console.log('Audiocontext State:', this.audioCtx.state);

    this.decideAction({
      action: 'ADD_OSC',
      data: {
        channel: this.sinKey,
        initFreq: 200
      }
    })
    this.decideAction({
      action: 'ADD_OSC',
      data: {
        channel: this.triKey,
        initFreq: 200
      }
    })
    this.decideAction({
      action: 'ADD_OSC',
      data: {
        channel: this.squKey,
        initFreq: 200
      }
    })
    this.decideAction({
      action: 'ADD_OSC',
      data: {
        channel: this.sawKey,
        initFreq: 200
      }
    })

    /**
     * Setup Subscription receiver
     * on channel: mixerEvent
     * 
     * The data being passed here is from the Canvas Element.
     */
    subFn('mixerEvent', (evData: any) => {
      this.decideAction(evData);
    });
  }

  public render() {
    return (
      <div
        className={`app-mixer`}
        style={{
          alignItems: 'center',
          display: 'grid',
          gridTemplateRows: 'repeat(4, 1fr)'
        }}
      >
        {Object.entries(this.channels).map((channel: any, index: number) => {
          return <MixerChannel
            key={index}
            // Values  
            channelName={channel[0]}
            {...channel[1]} 
            {...this.channelDefaults}
            // Functions
            handleMute={this.muteChannelNodes}
            handleUnMute={this.unmuteChannelNodes}
            handleVolumeChange={this.updateChannelVol}
          />
        })}
      </div>
    )
  }
}
