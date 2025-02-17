import { useEffect, useState } from "react";
import { Kiosk } from "../Models/Kiosk";
import { KioskState } from "../Models/KioskState";
import configData from "../config.json"
import "../Kiosk.css";
import AddGameButton from "./AddGameButton";
import {QRCodeSVG} from 'qrcode.react';
import { generateKioskCodeAsync, getGameCodeAsync, isLocal } from "../BackendRequests";
interface IProps {
    kiosk: Kiosk
  }

const AddingGame: React.FC<IProps> = ({ kiosk }) => {
    // TODO: update the urls to be more flexible for production code.
    const [kioskCode, setKioskCode] = useState("");
    const [renderQRCode, setRenderQRCode] = useState(true);
    const [menuButtonSelected, setMenuButtonState] = useState(false);
    const [qrCodeButtonSelected, setQrButtonState] = useState(false);
    const kioskCodeUrl = isLocal() ? "http://localhost:3000/static/kiosk/" : "https://arcade.makecode.com/kiosk";

    const updateLoop = () => {
        if (!menuButtonSelected && kiosk.gamepadManager.isDownPressed()) {
            setMenuButtonState(true);
            if (qrCodeButtonSelected) {
                setQrButtonState(false);
            }
        }
        if (menuButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            kiosk.showMainMenu();
        }
        if (!renderQRCode && kiosk.gamepadManager.isUpPressed()) {
            setMenuButtonState(false);
            setQrButtonState(true);
        }
        if (qrCodeButtonSelected && kiosk.gamepadManager.isAButtonPressed()) {
            setRenderQRCode(true);
        }
    }

    useEffect(() => {
        let intervalId: any = null;
        intervalId = setInterval(() => {
            updateLoop();
        }, configData.GamepadPollLoopMilli);
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    });

    useEffect(() => {
        async function generateKioskCode() {
            try {
                const newKioskCode: string = await generateKioskCodeAsync();
                setKioskCode(newKioskCode);
                await addGameToKiosk(newKioskCode);
            }
            catch (error) {
                setRenderQRCode(false);
                throw new Error("Unable to generate kiosk code");
            }
        }

        generateKioskCode();

        function addGameToKiosk(kioskCode: string) {
            const timeoutDuration = 600000; // wait for 10 minutes until the kiosk code expires
            const whenToPoll = 5000; // wait for 5 seconds to poll for game code data
            if (kiosk.state !== KioskState.AddingGame) {
                return;
            }
            return new Promise<void>(async (resolve, reject) => {
                let pollFrequency: any;
                let pollTimeout: any;
                const getGameCode = async () => {
                    try {
                        const gameCode: string = await getGameCodeAsync(kioskCode);
                        await kiosk.saveNewGameAsync(gameCode);
                        clearTimeout(pollFrequency);
                        clearTimeout(pollTimeout);
                        resolve();
                        kiosk.launchGame(gameCode);
                    }
                    catch (error) {
                        pollFrequency = setTimeout(async () => {
                            await getGameCode();
                        }, whenToPoll)
                    }
                };

                pollTimeout = setTimeout(() => {
                    clearTimeout(pollTimeout);
                    clearTimeout(pollFrequency);
                    reject();
                }, timeoutDuration)

                await getGameCode();
            });
        }
    }, [renderQRCode]);

    const qrDivContent = () => {
        if (renderQRCode) {
            return (
                <div className="innerQRCodeContent">
                    <QRCodeSVG value={`${kioskCodeUrl}#add-game:${kioskCode}`} />
                    <h3>10 minute Kiosk ID</h3>
                    <h1>{kioskCode}</h1>
                </div>
            )
        }
        else {
            return (
                <div className="innerQRCodeContent">
                    <AddGameButton selected={qrCodeButtonSelected} content="Generate new QR code" />
                </div>
            )
        }
    };

    return (
        <div className="addGame">
            <h1>Add your game</h1>
            <div className="addGameContent">
                <div className="addInstructions">
                    <h2>How to upload your game</h2>
                    <ol>
                        <li>Scan the QR code to the right with your phone or webcam</li>
                        <li>Open the link to scan your game's QR code</li>
                        <li>Return to the Kiosk Main Menu</li>
                        <li>You will find your game to the left of the GalgaMulti game</li>
                    </ol>
                </div>

                <div className="QRCodeHolder">
                    {qrDivContent()}
                </div>
            </div>
            <AddGameButton selected={menuButtonSelected} content="Return to menu" />
        </div>

    )
}

export default AddingGame;