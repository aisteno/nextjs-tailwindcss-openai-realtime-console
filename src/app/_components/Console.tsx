"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { type ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../_lib/wavtools/index.js';
import { instructions } from '../_utils/conversation_config';
import { WavRenderer } from '../_utils/wav_renderer';
import { X, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../_components/button/Button';
import { Toggle } from '../_components/toggle/Toggle';
import type { Coordinates, OpenMeteoResponse, RealtimeEvent } from "~/types"

import dynamic from 'next/dynamic';
const LazyMap = dynamic(() => import('../_components/map/Map').then((mod) => mod.Map), { ssr: false });

type Props = {
    relayServerUrl: string;
}

const Console = ({ relayServerUrl }: Props) => {
    /**
     * Ask user for API Key
     * If we're using the local relay server, we don't need this
     */

    /**
     * Instantiate:
     * - WavRecorder (speech input)
     * - WavStreamPlayer (speech output)
     * - RealtimeClient (API client)
     */
    const wavRecorderRef = useRef<WavRecorder>(
        new WavRecorder({ sampleRate: 24000 })
    );
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(
        new WavStreamPlayer({ sampleRate: 24000 })
    );
    const clientRef = useRef<RealtimeClient>(
        new RealtimeClient(
            process.env.NEXT_PUBLIC_OPENAI_API_KEY ?
                { apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, dangerouslyAllowAPIKeyInBrowser: true } :
                { url: relayServerUrl }
        )
    );

    /**
     * References for
     * - Rendering audio visualization (canvas)
     * - Autoscrolling event logs
     * - Timing delta for event log displays
     */
    const clientCanvasRef = useRef<HTMLCanvasElement>(null);
    const serverCanvasRef = useRef<HTMLCanvasElement>(null);
    const eventsScrollHeightRef = useRef(0);
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<string>(new Date().toISOString());

    /**
     * All of our variables for displaying application state
     * - items are all conversation items (dialog)
     * - realtimeEvents are event logs, which can be expanded
     * - memoryKv is for set_memory() function
     * - coords, marker are for get_weather() function
     */
    const [items, setItems] = useState<ItemType[]>([]);
    const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
    const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
    const [isConnected, setIsConnected] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [memoryKv, setMemoryKv] = useState<Record<string, unknown>>({});
    const [coords, setCoords] = useState<Coordinates | null>({
        lat: 37.775593,
        lng: -122.418137,
    });
    const [marker, setMarker] = useState<Coordinates | null>(null);

    /**
     * Utility for formatting the timing of logs
     */
    const formatTime = useCallback((timestamp: string) => {
        const startTime = startTimeRef.current;
        const t0 = new Date(startTime).valueOf();
        const t1 = new Date(timestamp).valueOf();
        const delta = t1 - t0;
        const hs = Math.floor(delta / 10) % 100;
        const s = Math.floor(delta / 1000) % 60;
        const m = Math.floor(delta / 60_000) % 60;
        const pad = (n: number) => {
            let s = n + '';
            while (s.length < 2) {
                s = '0' + s;
            }
            return s;
        };
        return `${pad(m)}:${pad(s)}.${pad(hs)}`;
    }, []);

    /**
     * Connect to conversation:
     * WavRecorder taks speech input, WavStreamPlayer output, client is API client
     */
    const connectConversation = useCallback(async () => {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        // Set state variables
        startTimeRef.current = new Date().toISOString();
        setIsConnected(true);
        setRealtimeEvents([]);
        setItems(client.conversation.getItems());

        // Connect to microphone
        await wavRecorder.begin();

        // Connect to audio output
        await wavStreamPlayer.connect();

        // Connect to realtime API
        await client.connect();
        client.sendUserMessageContent([
            {
                type: `input_text`,
                text: `Hello!`,
                // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
            },
        ]);

        if (client.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
    }, []);

    /**
     * Disconnect and reset conversation state
     */
    const disconnectConversation = useCallback(async () => {
        setIsConnected(false);
        setRealtimeEvents([]);
        setItems([]);
        setMemoryKv({});
        setCoords({
            lat: 37.775593,
            lng: -122.418137,
        });
        setMarker(null);

        const client = clientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        wavStreamPlayer.interrupt();
    }, []);

    const deleteConversationItem = useCallback(async (id: string) => {
        const client = clientRef.current;
        client.deleteItem(id);
    }, []);

    /**
     * In push-to-talk mode, start recording
     * .appendInputAudio() for each sample
     */
    const startRecording = async () => {
        setIsRecording(true);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const trackSampleOffset = wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
            const { trackId, offset } = trackSampleOffset;
            client.cancelResponse(trackId, offset);
        }
        await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    };

    /**
     * In push-to-talk mode, stop recording
     */
    const stopRecording = async () => {
        setIsRecording(false);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.pause();
        client.createResponse();
    };

    /**
     * Switch between Manual <> VAD mode for communication
     */
    const changeTurnEndType = async (value: string) => {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        if (value === 'none' && wavRecorder.getStatus() === 'recording') {
            await wavRecorder.pause();
        }
        client.updateSession({
            turn_detection: value === 'none' ? null : { type: 'server_vad' },
        });
        if (value === 'server_vad' && client.isConnected()) {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
        setCanPushToTalk(value === 'none');
    };

    /**
     * Auto-scroll the event logs
     */
    useEffect(() => {
        if (eventsScrollRef.current) {
            const eventsEl = eventsScrollRef.current;
            const scrollHeight = eventsEl.scrollHeight;
            // Only scroll if height has just changed
            if (scrollHeight !== eventsScrollHeightRef.current) {
                eventsEl.scrollTop = scrollHeight;
                eventsScrollHeightRef.current = scrollHeight;
            }
        }
    }, [realtimeEvents]);

    /**
     * Auto-scroll the conversation logs
     */
    useEffect(() => {
        const conversationEls = [].slice.call(
            document.body.querySelectorAll('[data-conversation-content]')
        );
        for (const el of conversationEls) {
            const conversationEl = el as HTMLDivElement;
            conversationEl.scrollTop = conversationEl.scrollHeight;
        }
    }, [items]);

    /**
     * Set up render loops for the visualization canvas
     */
    useEffect(() => {
        let isLoaded = true;

        const wavRecorder = wavRecorderRef.current;
        const clientCanvas = clientCanvasRef.current;
        let clientCtx: CanvasRenderingContext2D | null = null;

        const wavStreamPlayer = wavStreamPlayerRef.current;
        const serverCanvas = serverCanvasRef.current;
        let serverCtx: CanvasRenderingContext2D | null = null;

        const render = () => {
            if (isLoaded) {
                if (clientCanvas) {
                    if (!clientCanvas.width || !clientCanvas.height) {
                        clientCanvas.width = clientCanvas.offsetWidth;
                        clientCanvas.height = clientCanvas.offsetHeight;
                    }
                    clientCtx = clientCtx ?? clientCanvas.getContext('2d');
                    if (clientCtx) {
                        clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
                        const result = wavRecorder.recording
                            ? wavRecorder.getFrequencies('voice')
                            : { values: new Float32Array([0]) };
                        WavRenderer.drawBars(
                            clientCanvas,
                            clientCtx,
                            result.values,
                            '#0099ff',
                            10,
                            0,
                            8
                        );
                    }
                }
                if (serverCanvas) {
                    if (!serverCanvas.width || !serverCanvas.height) {
                        serverCanvas.width = serverCanvas.offsetWidth;
                        serverCanvas.height = serverCanvas.offsetHeight;
                    }
                    serverCtx = serverCtx ?? serverCanvas.getContext('2d');
                    if (serverCtx) {
                        serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
                        const result = wavStreamPlayer.analyser
                            ? wavStreamPlayer.getFrequencies('voice')
                            : { values: new Float32Array([0]) };
                        WavRenderer.drawBars(
                            serverCanvas,
                            serverCtx,
                            result.values,
                            '#009900',
                            10,
                            0,
                            8
                        );
                    }
                }
                window.requestAnimationFrame(render);
            }
        };
        render();

        return () => {
            isLoaded = false;
        };
    }, []);

    /**
     * Core RealtimeClient and audio capture setup
     * Set all of our instructions, tools, events and more
     */
    useEffect(() => {
        // Get refs
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const client = clientRef.current;

        // Set instructions
        client.updateSession({ instructions: instructions });
        // Set transcription, otherwise we don't get user transcriptions back
        client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

        // Add tools
        client.addTool(
            {
                name: 'set_memory',
                description: 'Saves important data about the user into memory.',
                parameters: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description:
                                'The key of the memory value. Always use lowercase and underscores, no other characters.',
                        },
                        value: {
                            type: 'string',
                            description: 'Value can be anything represented as a string',
                        },
                    },
                    required: ['key', 'value'],
                },
            },
            async ({ key, value }: Record<string, string>) => {
                setMemoryKv((memoryKv) => {
                    const newKv = { ...memoryKv };
                    if (key && value) newKv[key] = value;
                    return newKv;
                });
                return { ok: true };
            }
        );
        client.addTool(
            {
                name: 'get_weather',
                description:
                    'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
                parameters: {
                    type: 'object',
                    properties: {
                        lat: {
                            type: 'number',
                            description: 'Latitude',
                        },
                        lng: {
                            type: 'number',
                            description: 'Longitude',
                        },
                        location: {
                            type: 'string',
                            description: 'Name of the location',
                        },
                    },
                    required: ['lat', 'lng', 'location'],
                },
            },
            async ({ lat, lng, location }: { lat: number, lng: number, location: string }) => {
                setMarker({ lat, lng, location });
                setCoords({ lat, lng, location });
                const result = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
                );
                const json = await result.json() as OpenMeteoResponse;
                const temperature = {
                    value: json.current.temperature_2m,
                    units: json.current_units.temperature_2m,
                };
                const wind_speed = {
                    value: json.current.wind_speed_10m,
                    units: json.current_units.wind_speed_10m,
                };
                setMarker({ lat, lng, location, temperature, wind_speed });
                return json;
            }
        );

        // handle realtime events from client + server for event logging
        client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
            setRealtimeEvents((realtimeEvents) => {
                const lastEvent = realtimeEvents[realtimeEvents.length - 1];
                if (lastEvent && lastEvent?.event.type === realtimeEvent.event.type) {
                    // if we receive multiple events in a row, aggregate them for display purposes
                    lastEvent.count = (lastEvent.count ?? 0) + 1;
                    return realtimeEvents.slice(0, -1).concat(lastEvent);
                } else {
                    return realtimeEvents.concat(realtimeEvent);
                }
            });
        });
        client.on('error', (event: unknown) => console.error(event));
        client.on('conversation.interrupted', async () => {
            const trackSampleOffset = wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                client.cancelResponse(trackId, offset);
            }
        });
        client.on('conversation.updated', async ({
            item,
            delta
        }: {
            item: {
                id: string;
                status: string;
                formatted: {
                    audio?: Uint8Array | number[];
                    file?: {
                        url: string;
                    };
                };
            };
            delta: {
                audio?: Uint8Array | number[];
            };
        }) => {
            const items = client.conversation.getItems();
            if (delta?.audio) {
                const deltaAudio = delta.audio as Int16Array | ArrayBuffer;
                wavStreamPlayer.add16BitPCM(deltaAudio, item.id);
            }
            if (item.status === 'completed' && item.formatted.audio?.length) {
                const wavFile = await WavRecorder.decode(
                    item.formatted.audio,
                    24000,
                    24000
                );
                item.formatted.file = wavFile;
            }
            setItems(items);
        });

        setItems(client.conversation.getItems());

        return () => {
            // cleanup; resets to defaults
            client.reset();
        };
    }, []);

    /**
     * Render the application
     */
    return (
        <div className='h-dvh flex flex-col overflow-hidden mx-2 my-0 text-sm'>
            <div className="flex items-center px-6 py-4 min-h-10">
                <div className="flex-grow flex items-center gap-3">
                    <span>NextJS + TailwindCSS - realtime console</span>
                </div>
                <div className="flex-shrink-0">
                    <span>Built with ❤️ by <a href="https://steno.ai" target="_blank" rel="noopener noreferrer">steno.ai</a></span>
                </div>
            </div>
            <div className="flex flex-grow overflow-hidden mx-4 my-0 mb-6 flex-shrink">
                <div className="flex flex-col flex-grow overflow-hidden">
                    <div className="relative flex flex-col max-h-[100%] w-full border-t-[1px] flex-grow overflow-hidden border-[#e7e7e7]">
                        <div className="absolute flex bottom-1 right-2 p-1 rounded-2xl z-10 gap-0.5">
                            <div className="text-[#0099ff] relative flex items-center h-10 w-24 gap-1">
                                <canvas ref={clientCanvasRef} />
                            </div>
                            <div className="text-[#009900] relative flex items-center h-10 w-24 gap-1">
                                <canvas ref={serverCanvasRef} />
                            </div>
                        </div>
                        <div className="relative flex-shrink-0 pt-4 pb-1">events</div>
                        <div className="relative text-[#6e6e7f] flex-grow py-0 overflow-auto" ref={eventsScrollRef}>
                            {!realtimeEvents.length && `awaiting connection...`}
                            {realtimeEvents.map((realtimeEvent) => {
                                const count = realtimeEvent.count;
                                const event = { ...realtimeEvent.event } as {
                                    audio?: Uint8Array | number[] | string;
                                    delta?: Uint8Array | number[] | string;
                                    type: string;
                                    event_id: string;
                                };
                                if (event.type === 'input_audio_buffer.append') {
                                    event.audio = `[trimmed: ${event.audio?.length} bytes]`;
                                } else if (event.type === 'response.audio.delta') {
                                    event.delta = `[trimmed: ${event.delta?.length} bytes]`;
                                }
                                return (
                                    <div className="rounded-sm whitespace-pre flex p-0 gap-4" key={event.event_id}>
                                        <div className="text-left gap-2 px-1 py-0 w-20 flex-shrink-0 mr-4">
                                            {formatTime(realtimeEvent.time)}
                                        </div>
                                        <div className="flex flex-col gap-2 text-[#18181b]">
                                            <div
                                                className="px-1 py-2 mx-0 -my-2 flex items-center cursor-pointer gap-2"
                                                onClick={() => {
                                                    // toggle event details
                                                    const id = event.event_id;
                                                    const expanded = { ...expandedEvents };
                                                    if (expanded[id]) {
                                                        delete expanded[id];
                                                    } else {
                                                        expanded[id] = true;
                                                    }
                                                    setExpandedEvents(expanded);
                                                }}
                                            >
                                                <div
                                                    className={`flex-shrink-0 flex items-center gap-2 ${event.type === 'error'
                                                        ? 'text-[#990000]'
                                                        : realtimeEvent.source === 'client'
                                                            ? 'text-[#0099ff]'
                                                            : 'text-[#009900]'
                                                        }`}
                                                >
                                                    {realtimeEvent.source === 'client' ? (
                                                        <ArrowUp />
                                                    ) : (
                                                        <ArrowDown />
                                                    )}
                                                    <span>
                                                        {event.type === 'error'
                                                            ? 'error!'
                                                            : realtimeEvent.source}
                                                    </span>
                                                </div>
                                                <div className="event-type">
                                                    {event.type}
                                                    {count && ` (${count})`}
                                                </div>
                                            </div>
                                            {!!expandedEvents[event.event_id] && (
                                                <div className="event-payload">
                                                    {JSON.stringify(event, null, 2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-col w-full  relative flex-grow flex-shrink-0 overflow-hidden h-[200px] min-h-0 max-h-[200px] border-t-[1px] border-[#e7e7e7]">
                        <div className="flex-shrink-0 pt-4 pb-1 relative">conversation</div>
                        <div className="text-[#6e6e7f] relative flex-grow py-0 overflow-auto" data-conversation-content>
                            {!items.length && `awaiting connection...`}
                            {items.map((conversationItem) => {
                                return (
                                    <div className="relative flex gap-4 mb-4" key={conversationItem.id}>
                                        <div className={`relative text-left w-20 flex-shrink-0 mr-4 ${conversationItem.role === "user" ? 'text-[#0099ff]' : 'text-[#009900]'}`}>
                                            <div>
                                                {(
                                                    conversationItem.role ?? conversationItem.type
                                                ).replaceAll('_', ' ')}
                                            </div>
                                            <div
                                                className="close"
                                                onClick={() =>
                                                    deleteConversationItem(conversationItem.id)
                                                }
                                            >
                                            </div>
                                        </div>
                                        <div className="text-[#18181b] overflow-hidden break-words">
                                            {/* tool response */}
                                            {conversationItem.type === 'function_call_output' && (
                                                <div>{conversationItem.formatted.output}</div>
                                            )}
                                            {/* tool call */}
                                            {!!conversationItem.formatted.tool && (
                                                <div>
                                                    {conversationItem.formatted.tool.name}(
                                                    {conversationItem.formatted.tool.arguments})
                                                </div>
                                            )}
                                            {!conversationItem.formatted.tool &&
                                                conversationItem.role === 'user' && (
                                                    <div>
                                                        {conversationItem.formatted.transcript ??
                                                            (conversationItem.formatted.audio?.length
                                                                ? '(awaiting transcript)'
                                                                : conversationItem.formatted.text ??
                                                                '(item sent)')}
                                                    </div>
                                                )}
                                            {!conversationItem.formatted.tool &&
                                                conversationItem.role === 'assistant' && (
                                                    <div>
                                                        {conversationItem.formatted.transcript ??
                                                            conversationItem.formatted.text ??
                                                            '(truncated)'}
                                                    </div>
                                                )}
                                            {conversationItem.formatted.file && (
                                                <audio
                                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                                                    src={conversationItem.formatted.file.url}
                                                    controls
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-grow-0 flex-shrink-0 items-center justify-between gap-4">
                        <Toggle
                            defaultValue={false}
                            labels={['manual', 'vad']}
                            values={['none', 'server_vad']}
                            onChange={(_, value) => changeTurnEndType(value)}
                        />
                        <div className="flex-grow-1" />
                        {isConnected && canPushToTalk && (
                            <Button
                                label={isRecording ? 'release to send' : 'push to talk'}
                                buttonStyle={isRecording ? 'alert' : 'regular'}
                                disabled={!isConnected || !canPushToTalk}
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                            />
                        )}
                        <div className="flex-grow-1" />
                        <Button
                            label={isConnected ? 'disconnect' : 'connect'}
                            iconPosition={isConnected ? 'end' : 'start'}
                            icon={isConnected ? X : Zap}
                            buttonStyle={isConnected ? 'regular' : 'action'}
                            onClick={
                                isConnected ? disconnectConversation : connectConversation
                            }
                        />
                    </div>
                </div>
                <div className="w-[300px] flex flex-shrink-0 flex-col ml-6 gap-6 text-sm">
                    <div className="relative flex flex-col max-h-full w-full rounded-2xl flex-grow flex-shrink-0 overflow-hidden">
                        <div className="flex absolute items-center justify-center top-4 left-4 bg-white rounded-full min-h-8 z-[999] text-center whitespace-pre px-4 py-2 shadow-md border border-gray-200">get_weather()</div>
                        <div className="flex absolute items-center justify-center bottom-4 right-4 bg-white rounded-full min-h-8 z-[999] text-center whitespace-pre px-4 py-2 shadow-md border border-gray-200">
                            {marker?.location ?? 'not yet retrieved'}
                            {!!marker?.temperature && (
                                <>
                                    <br />
                                    🌡️ {marker.temperature.value} {marker.temperature.units}
                                </>
                            )}
                            {!!marker?.wind_speed && (
                                <>
                                    {' '}
                                    🍃 {marker.wind_speed.value} {marker.wind_speed.units}
                                </>
                            )}
                        </div>
                        <div className="relative text-[#6e6e7f] flex-grow overflow-hidden rounded-2xl">
                            {coords && (
                                <LazyMap
                                    center={[coords.lat, coords.lng]}
                                    location={coords.location}
                                />
                            )}
                        </div>
                    </div>
                    <div className="h-[250px] max-h-[250px] whitespace-pre rounded-2xl flex-grow flex-shrink-0 overflow-hidden relative bg-[#ececf1]">
                        <div className="absolute flex items-center justify-center top-4 left-4 px-4 py-2 bg-white rounded-full z-50 text-center whitespace-pre min-h-[32px]">set_memory()</div>
                        <div className="relative p-4 mt-[56px] text-[#6e6e7f] flex-grow overflow-auto">
                            {JSON.stringify(memoryKv, null, 2)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Console
