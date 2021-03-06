import React, { Component } from 'react';

import * as faceapi from "face-api.js";

const centerStyle = {
    justifyContent: 'space-around',
    display: 'flex',
};

export type Emotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry' | 'disgusted' | 'fearful'

interface IProps {
    setEmotion(em: Emotion): void;
    onRunning?(): void;
    noCenter?: boolean;
    height?: number;
    width?: number;
    mobile?: boolean;
    webcamHeight?: number;
    webcamWidth?: number;
    onVideoStream?: (stream: MediaStream) => void
}

interface IFaceAPIState {
    ready: boolean;
    running: boolean;
    started: boolean;
    emotion?: string;
}

/** EXAMPLE USAGE:
 *  <FaceAPI
 *      setEmotion={em => handleEmotionChange(em)}
 *      onRunning={() => this.setState({ loading: false })}
 *      mobile={this.state.mobile}
 *  />
 */
export default class FaceAPI extends Component<IProps, IFaceAPIState> {
    webcamId: string = "webcam";
    canvasId: string = "overlay";
    mounted: boolean;
    constructor(props: Readonly<IProps>) {
        super(props);
        this.state = { ready: false, started: false, running: false};
        this.mounted = true;
    }

    componentWillUnmount() {
       this.mounted = false;
       console.log("face api unmounted!");
    }

    async loadModel() {
        const MODEL_URL = '/models';
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
        await faceapi.loadAgeGenderModel(MODEL_URL);
        await faceapi.loadFaceExpressionModel(MODEL_URL);
        this.setState({ ready: true });
        console.log("loaded models")
    }

    async applyModel(videoElement: HTMLVideoElement, canvas: HTMLCanvasElement) {
        const detections = await faceapi.detectSingleFace(videoElement).withFaceExpressions()
        if (!detections) {
            console.log("Detections are undefined :-( Model is not ready yet?")
        } else {
            if(!this.state.running) {
                if(this.props.onRunning){
                    this.props.onRunning();
                }
                this.setState({running: true});
            }
            const dims = faceapi.matchDimensions(canvas, videoElement, true);
            const resizedResult = faceapi.resizeResults(detections, dims);
            mirrorBox(resizedResult);
            if (resizedResult) {
                faceapi.draw.drawDetections(canvas, resizedResult);
                faceapi.draw.drawFaceExpressions(canvas, resizedResult, 0.05)
            }
            let maxConfidenceEmotion = "neutral";
            let confidence = 0.0;
            for (let [emotion, newConfidence] of Object.entries(detections.expressions)) {
                if (newConfidence > confidence) {
                    maxConfidenceEmotion = emotion;
                    confidence = newConfidence;
                }
            }
            if (confidence > 0.4 && this.state.emotion !== maxConfidenceEmotion) {
                this.setState({ emotion: maxConfidenceEmotion });
                this.props.setEmotion(maxConfidenceEmotion as Emotion);
                console.log(maxConfidenceEmotion);
            }
        }
        if(this.mounted) {
            setTimeout(() => this.applyModel(videoElement, canvas), 50);
        }
    }

    async startModel() {
        this.setState({ started: true });
        if (!this.state.ready) {
            await this.loadModel();
        }
        const videoElement = document.getElementById(this.webcamId) as HTMLVideoElement
        const canvas = document.getElementById(this.canvasId) as HTMLCanvasElement
        console.log("starting face detection loop")
        await this.applyModel(videoElement, canvas);
    }
    async componentDidMount() {
        if(this.mounted) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.getElementById(this.webcamId) as HTMLMediaElement;
            video.srcObject = stream;
            
            video.play()
            if (!this.state.started) {
                this.startModel();
            }
            if (this.props.onVideoStream) {
                this.props.onVideoStream(stream)
            }
        }
    }
    render() {
        if(!this.mounted) {
            return null;
        }

        const adjustedCenterStyle = Object.assign({maxWidth: '40vh'}, centerStyle)

        let divStyle = this.props.noCenter ? {} : 
            (!this.props.mobile ? centerStyle : adjustedCenterStyle);
        
        const videoStyle = {
            transform: "rotateY(180deg)",
            width: '100%',
        }
        const canvasStyle = {
            top: "0px", 
            left: "0px",
            width: '100%',
        }
        
        if(this.props.width && this.props.height) {
            Object.assign(videoStyle, {
                width: this.props.width,
                height: this.props.height,
            });
            Object.assign(canvasStyle, {
                width: this.props.width,
                height: this.props.height,
            });
        }

        const containerStyle = Object.assign({position: 'relative' as 'relative'}, divStyle);

        return (
            <div style={{justifyContent: 'space-around', display: 'flex',}} className={"webcam-component-out"}>
                <div style={containerStyle} className={"webcam-component"}>
                    <video
                        style={videoStyle} id={this.webcamId}
                    >
                    </video>
                    <canvas style={Object.assign(canvasStyle, {position: 'absolute'})} id={this.canvasId}></canvas>
                </div>
            </div>
        );
    }
}


const mirrorBox = (results: object) => {
    const w = results['detection']['_imageDims']['width'];
    const box = results['detection']['box'];

    const mirrored = Object.assign({}, results);

    const newBox = {
        area: box.area,
        bottom: box.bottom,
        topLeft: {
            x: w - box.x - box.width,
            y: box.y,
        },
        topRight: {
            x: w - box.x,
            y: box.y,
        },
        bottomLeft: {
            x: w - box.x - box.width,
            y: box.y + box.height,
        },
        bottomRight: {
            x: w - box.x,
            y: box.y + box.height,
        },
        x: w - box.x - box.width,
        y: box.y,
        _x: w - box._x - box.width,
        _y: box._y,
        width: box.width,
        height: box.height,
        _width: box._width,
        _height: box._height,
    }

    mirrored['detection']['_box'] = newBox;
    return mirrored;
}
