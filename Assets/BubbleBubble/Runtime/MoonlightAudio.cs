using System;
using UnityEngine;

namespace BubbleBubble
{
    [RequireComponent(typeof(AudioSource))]
    public sealed class MoonlightAudio : MonoBehaviour
    {
        AudioSource source;
        AudioClip calm, danger;
        bool inDanger, paused;
        public bool Enabled { get; private set; }
        void Awake()
        {
            Enabled=PlayerPrefs.GetInt("bubblebubble.music",1)!=0;
            source=GetComponent<AudioSource>();source.loop=true;source.volume=.085f;source.playOnAwake=false;
            calm=Compose(false);danger=Compose(true);
        }
        public void Toggle() { Enabled=!Enabled;PlayerPrefs.SetInt("bubblebubble.music",Enabled?1:0);PlayerPrefs.Save();source.mute=!Enabled; }
        public void SetState(bool playing,bool dangerMode,bool pause)
        {
            source.mute=!Enabled;
            if(!playing) { source.Stop();return; }
            if(source.clip==null || inDanger!=dangerMode) { inDanger=dangerMode;source.clip=inDanger?danger:calm;source.Play(); }
            if(paused!=pause) { paused=pause;if(pause)source.Pause();else source.UnPause(); }
            if(!source.isPlaying && !pause)source.Play();
        }
        static AudioClip Compose(bool danger)
        {
            // Original web game's melody, expressed as MIDI pitches. 0 denotes a rest.
            int[] melody=danger?new[]{60,61,67,61,60,0,61,0,67,61,60,67,61,0,60,0}:
                new[]{76,79,81,79,76,74,72,0,74,76,79,76,74,72,74,0,76,79,83,81,79,76,74,72,69,72,76,74,72,0,67,0};
            int[] bass=danger?new[]{48,0,49,0,48,0,55,0,49,0,48,0,55,0,49,0}:
                new[]{60,0,0,0,55,0,0,0,62,0,0,0,55,0,0,0,57,0,0,0,64,0,0,0,62,0,0,0,55,0,0,0};
            const int rate=44100;double step=60.0/(danger?154:116)/2;int length=(int)(step*melody.Length*rate);var data=new float[length];
            for(int i=0;i<melody.Length;i++) { Add(data,rate,i*step,step*.8,melody[i],danger?.26:.5,danger?2:0);Add(data,rate,i*step,step*1.8,bass[i],danger?.2:.1,danger?2:1); }
            var clip=AudioClip.Create(danger?"Moonlight danger":"Moonlight march",length,1,rate,false);clip.SetData(data,0);return clip;
        }
        static void Add(float[] data,int rate,double start,double duration,int note,double volume,int wave)
        {
            if(note==0)return;double frequency=440*Math.Pow(2,(note-69)/12.0);
            for(int i=0;i<(int)(duration*rate);i++)
            {
                double t=i/(double)rate,phase=(t*frequency)%1;
                double signal=wave==0?1-4*Math.Abs(phase-.5):wave==1?(phase<.5?1:-1):2*phase-1;
                double env=Math.Min(1,t/.012)*Math.Exp(-6*t/duration);
                int index=((int)(start*rate)+i)%data.Length;data[index]+=(float)(signal*volume*env);
            }
        }
        void OnDestroy() { if(calm!=null)Destroy(calm);if(danger!=null)Destroy(danger); }
    }
}
