import { MDCRipple } from '@material/ripple';
import { MDCSnackbar } from '@material/snackbar';
import { getCombo, getElementData, getElementDataCache, sendSuggestion, getSuggestions, getStats, searchAudioPack, searchTheme } from "./api-interface";
import { IElement } from '../../shared/api-1-types';
import { delay, delayFrame, arrayGet3Random, formatDate, escapeHTML } from '../../shared/shared';
import { assertElementColor } from './assert';
import { PlaySound, getAudioPackList, SetSoundPack, addPack } from './audio'; 
import { SetTheme, getThemeList, AddTheme, isFlipped } from './theme';
const MDCMenu = require("@material/menu")["MDCMenu"];

export const elements: { [id: string]: { dom: HTMLElement, elem: IElement} } = {};
let held_element: null | string = null;
let last_held_element: null | string = null;
let offsetX, offsetY;
let mx, my;
let mouseCalcX = 0, mouseCalcY = 0;

let fadedElement: HTMLElement | undefined;
let elemContainer: HTMLElement;

let elementinfo: HTMLElement;

let suggestRecipe = '';
export async function showSuggestDialog(e1: string, e2: string) {
    const elem = document.querySelector("#suggest-elem-container");
    elem.classList.add("visible");
    const recipeElem = document.querySelectorAll(".elements-to-combine .element");
    const e1e = getElementDataCache(e1);
    const e2e = getElementDataCache(e2);
    recipeElem[0].innerHTML = escapeHTML(e1e.display);
    recipeElem[1].innerHTML = escapeHTML(e2e.display);
    
    recipeElem[0].className = "element " + e1e.color;
    recipeElem[1].className = "element " + e2e.color;

    suggestRecipe = e1 + "+" + e2;

    document.querySelector(".suggestelement").className = "suggestelement white";
    document.querySelector(".suggestelement").innerHTML = "Your Element";

    document.getElementById("suggestother1").parentElement.classList.add("non-visible");
    document.getElementById("suggestother2").parentElement.classList.add("non-visible");
    document.getElementById("suggestother3").parentElement.classList.add("non-visible");
    document.getElementById("submit-your-element").setAttribute("disabled","yeah");
    const suggestions = arrayGet3Random(await getSuggestions(suggestRecipe));
    
    if(suggestions[0]) {
        const elem = document.getElementById("suggestother1");
        elem.innerHTML = escapeHTML(suggestions[0].display);
        elem.className = "element " + suggestions[0].color;
        elem.parentElement.classList.remove("non-visible")
        elem.onclick = () => {
            document.querySelector(".suggestelement").className = "suggestelement " + suggestions[0].color;
            document.querySelector(".suggestelement").innerHTML = escapeHTML(suggestions[0].display);
            document.getElementById("submit-your-element").removeAttribute("disabled");

        };
    }
    if(suggestions[1]) {
        const elem = document.getElementById("suggestother2");
        elem.innerHTML = escapeHTML(suggestions[1].display);
        elem.className = "element " + suggestions[1].color;
        elem.parentElement.classList.remove("non-visible");
        elem.onclick = () => {
            document.querySelector(".suggestelement").className = "suggestelement " + suggestions[1].color;
            document.querySelector(".suggestelement").innerHTML = escapeHTML(suggestions[1].display);
            document.getElementById("submit-your-element").removeAttribute("disabled");

        };
    }
    if(suggestions[2]) {
        const elem = document.getElementById("suggestother3");
        elem.innerHTML = escapeHTML(suggestions[2].display);
        elem.className = "element " + suggestions[2].color;
        elem.parentElement.classList.remove("non-visible");
        elem.onclick = () => {
            document.querySelector(".suggestelement").className = "suggestelement " + suggestions[2].color;
            document.querySelector(".suggestelement").innerHTML = escapeHTML(suggestions[2].display);
            document.getElementById("submit-your-element").removeAttribute("disabled");

        };
    }
}

async function counterUpdate() {
    let total = (await getStats()).total_elements;
    let collected = localStorage.getItem("S").split("S").length;
    let percent = (100 * (collected / total)).toFixed(1);
    let elem = document.getElementById("total-counter")
    if (elem) {
        elem.innerHTML = `${collected} / ${total} (${percent}%)`;
    }
}


function cursor(state: boolean) {
    document.getElementById("element-container")
        .classList[state ? "add" : "remove"]("is-dragging-elem");
}

async function processCombo(src: string, dest: string) {
    const combo = await getCombo(src, dest);
    if(combo) {
        addUIElement(await getElementData(combo.result.id), dest);
    } else {
        // dont
        PlaySound("discover-nothing");
        showSuggestDialog(src,dest);
    }
}

async function moveback() {
    cursor(false);
    const dom = elements[held_element].dom;
    held_element = null;

    dom.classList.add("moveback");
    dom.classList.remove("is-held");

    await delay(2);
    dom.style.transform = "";
    dom.style.left = "";
    dom.style.top = "";

    await delay(350);
    dom.classList.remove("moveback");
    if (fadedElement) fadedElement.remove();
    elementinfo.classList.add("showtooltip");
}
async function shinkback() {
    cursor(false);
    let dom;
    if(held_element) {
        dom = elements[held_element].dom;
        last_held_element = held_element;
        held_element = null;
        
        fadedElement.classList.add("faded-element-fade");
        fadedElement.classList.remove("faded-element");
    
        dom.classList.add("moveback");
        dom.classList.remove("is-held");
    
        await delay(0);
        dom.style.transform = "scale(0.5)";
        dom.style.opacity = "0.0";
        // dom.style.left = "";
        // dom.style.top = "";
        
        await delay(350);
        dom.classList.remove("moveback");
        dom.style.transform = "";
        dom.style.opacity = "";
        dom.style.left = "";
        dom.style.top = "";
    }

    if (fadedElement) fadedElement.remove();
    elementinfo.classList.add("showtooltip");
}

export async function addUIElement(elem: IElement, srcElem?: string) {
    if (srcElem) {
        if (elem.id in elements) {
            PlaySound("discover-old");
        } else {
            PlaySound("discover-new");
        }
        let movingelem = document.createElement("div");
        movingelem.classList.add("element");
        movingelem.classList.add(elem.color); // classes have the color id names.
        movingelem.innerHTML = escapeHTML(elem.display);
        if (elem.display.length >= 13) { movingelem.style.fontSize = "0.9em"; }
        if (elem.display.length >= 20) { movingelem.style.fontSize = "0.85em"; }
        elemContainer.appendChild(movingelem);
        
        let dom = elements[srcElem].dom;
        if(dom.classList.contains("moveback")) {
            dom = (document.querySelector(".faded-element-fade") as HTMLElement) || elements[srcElem].dom;
        }
        let xx;
        let yy;
        let animatingSiblingCatagory = null;

        if (elem.id in elements) {
            xx = elements[elem.id].dom.offsetLeft;
            yy = elements[elem.id].dom.offsetTop;
        } else {
            let catagory = document.querySelector(".catagory.catagory-" + elem.color) as HTMLElement;
            let yy2 = 0;
            if (catagory) {
                const children = Array.from(catagory.children);
                let lastelem = children[children.length - 1];
                if(lastelem.classList.contains("moveback")) {
                    lastelem = document.querySelector(".faded-element-fade");
                }
                yy2 = (lastelem as HTMLElement).offsetTop;
                catagory.appendChild(movingelem);
            }
            xx = movingelem.offsetLeft;
            yy = movingelem.offsetTop;
            if (catagory && yy > yy2) {
                animatingSiblingCatagory = catagory.nextElementSibling as HTMLElement;
                animatingSiblingCatagory.style.transition = "padding-top 200ms";
                animatingSiblingCatagory.style.paddingTop = "89px";
            }
        }

        movingelem.style.position = "absolute";
        movingelem.style.left = (dom.offsetLeft) + "px";
        movingelem.style.top = (dom.offsetTop) + "px";
        movingelem.style.opacity = "0";
        movingelem.style.transform = "scale(0.5)";

        await delayFrame();
        await delayFrame();
        await delayFrame();
        
        movingelem.classList.add("fakemoveanimation");
        
        await delayFrame();

        movingelem.style.opacity = "1";
        movingelem.style.transform = "scale(1.3)";
        
        await delay(500);
        
        if(srcElem !== elem.id) {
            movingelem.style.left = xx + "px";
            movingelem.style.top = yy + "px";
        }
            
        movingelem.style.transform = "scale(1)";
        
        await delay(350);
        
        movingelem.classList.add("e2");
        if (animatingSiblingCatagory) animatingSiblingCatagory.style.transition = "";
        
        await delay(150);
        
        if (elem.id in elements) {
            movingelem.style.opacity = "0";
            await delay(200);
        };
        if (animatingSiblingCatagory) animatingSiblingCatagory.style.paddingTop = "";
        movingelem.remove();
    }
    // Verify element doesnt already exist.
    if(elem.id in elements) return;

    // Add the element's dom.
    const dom = document.createElement("div");
    dom.classList.add("element");
    dom.classList.add(elem.color); // classes have the color id names.
    elements[elem.id] = {
        dom,
        elem
    };

    // save
    localStorage.setItem("S", Object.keys(elements).join("S"));
    counterUpdate();

    dom.classList.add("moveback");
    if(!srcElem) {
        dom.style.transform = "scale(0.5)";
        dom.style.opacity = "0.0";
    }

    // Handle movement on elements
    let touchDown = false;
    dom.addEventListener("touchstart", () => {
        touchDown = true;
    });
    dom.addEventListener("click", async (ev) => {
        if(held_element) {
            processCombo(held_element, elem.id);
            shinkback();
            return;
        }
        await delay(1);
        cursor(true);

        elementinfo.classList.remove("showtooltip");

        fadedElement = document.createElement("div");
        fadedElement.classList.add("element");
        fadedElement.classList.add("faded-element");
        fadedElement.classList.add(elem.color); // classes have the color id names.
        fadedElement.innerHTML = escapeHTML(elem.display);
        elemContainer.appendChild(fadedElement);

        if (elem.display.length >= 13) { fadedElement.style.fontSize = "0.9em"; }
        if (elem.display.length >= 20) { fadedElement.style.fontSize = "0.85em"; }

        fadedElement.addEventListener("click", (ev) => {
            if(held_element)
                processCombo(held_element, elem.id);
            shinkback();
        });

        held_element = elem.id;

        const bodyRect = document.body.getBoundingClientRect(),
            elemRect = dom.getBoundingClientRect();

        offsetX = elemRect.left - bodyRect.left + 75 / 2;
        offsetY = elemRect.top - bodyRect.top + 75 / 2;

        if(isFlipped) {
            mouseCalcX = (offsetX - mx);
            mouseCalcY = (offsetY - my);
        } else {
            mouseCalcX = (mx - offsetX);
            mouseCalcY = (my - offsetY);
        }

        fadedElement.style.left = dom.offsetLeft + "px";
        fadedElement.style.top = dom.offsetTop + "px";

        dom.classList.add("moveback");
        dom.classList.add("is-held");

        dom.style.transform = "scale(0.8)";

        if (touchDown) {
            // touch
            dom.style.left = "32px";
            dom.style.top = "32px";

        } else {
            // mouse click
            if(isFlipped) {
                dom.style.left = (offsetX - ev.clientX) + "px";
                dom.style.top = (offsetY - ev.clientY + document.scrollingElement.scrollTop) + "px";
            } else {
                dom.style.left = (ev.clientX - offsetX) + "px";
                dom.style.top = (ev.clientY - offsetY + document.scrollingElement.scrollTop) + "px";
            }
        }
        
        await delay(200);
        dom.classList.remove("moveback");
    });
    window.addEventListener("touchmove", () => {
        touchDown = false;
    });
    window.addEventListener("touchend", () => {
        setTimeout(() => {
            touchDown = false;
        }, 200);
    });


    let catagory = document.querySelector(".catagory.catagory-" + elem.color);
    if(!catagory) {
        catagory = document.createElement("div");
        catagory.className = "catagory catagory-" + elem.color
        elemContainer.appendChild(catagory);
    }
    catagory.appendChild(dom);
    MDCRipple.attachTo(dom);
    dom.innerHTML = escapeHTML(elem.display);
    if(elem.display.length >= 13) { dom.style.fontSize = "0.9em"; }
    if (elem.display.length >= 20) { dom.style.fontSize = "0.85em"; }

    await delay(10);
    
    dom.style.transform = "";
    dom.style.opacity = "";

    await delay(300);
    dom.classList.remove("moveback");
}
export function initUIElementDragging() {
    counterUpdate();
    function heldElemOnCursor() {
        if (!held_element) return;
        const style = getComputedStyle(elemContainer);

        const dom = elements[held_element].dom;

        dom.style.left = "0";
        dom.style.top = "0";

        dom.style.left = Math.min(mouseCalcX, window.innerWidth - parseFloat(style.paddingLeft) - 75 - dom.offsetLeft + 15) + "px";
        dom.style.top = Math.min(mouseCalcY + document.scrollingElement.scrollTop, window.innerHeight + document.scrollingElement.scrollTop - parseFloat(style.paddingTop) - 75 - 64 - dom.offsetTop + 14) + "px";
    }
    window.addEventListener("scroll", (ev) => { 
        heldElemOnCursor();
    });
    window.addEventListener("mousemove", (ev) => {
        mx = ev.clientX;
        my = ev.clientY;
        if (isFlipped) {
            mouseCalcX = (offsetX - mx);
            mouseCalcY = (offsetY - my);
        } else {
            mouseCalcX = (mx - offsetX);
            mouseCalcY = (my - offsetY);
        }

        heldElemOnCursor();
    });
    window.addEventListener("click", async(ev) => {
        if (!(ev.target as HTMLElement).classList.contains("element")
        && held_element) {
            if (!elements[held_element].dom.classList.contains("moveback"))
            moveback();
        }
    })
    window.addEventListener("keydown", async(ev) => {
        if (ev.keyCode == 27) {
            if (held_element && !elements[held_element].dom.classList.contains("moveback")) {
                moveback();
                return;
            }

            const elem = document.querySelector("#suggest-elem-container");
            elem.classList.remove("visible");
        }
    });
    elemContainer = document.getElementById("element-container");

    const suggestElemEnter = document.querySelector(".suggestelement") as HTMLElement;
    suggestElemEnter.addEventListener("blur", () => {
        window.getSelection().removeAllRanges()
    });
    const colorPickerColors = document.querySelectorAll(".color");
    colorPickerColors.forEach(elem => {
        const color = Array.from(elem.classList).filter(x => x !== "color")[0];
        elem.addEventListener("click", () => {
            suggestElemEnter.className = "suggestelement " + color;
        });
        MDCRipple.attachTo(elem);
    });

    
    const submitElement = document.querySelector("#submit-your-element");
    const snackbar = new MDCSnackbar(document.querySelector('.mdc-snackbar'));
    
    MDCRipple.attachTo(submitElement);
    submitElement.addEventListener("click", () => {
        const elem = document.querySelector("#suggest-elem-container");
        const start_time = Date.now();
        elem.classList.remove("visible");
        const color = suggestElemEnter.className.substr(15)
        sendSuggestion(suggestRecipe, {
            display: suggestElemEnter.innerText,
            color: assertElementColor(color)
        }).then((r) => {
            if (r === "ok") {
                PlaySound("suggestion-sent");
                setTimeout(() => {
                    snackbar.show({
                        message: "Suggestion Sent!",
                        timeout: 1750,

                        actionHandler: ()=>{},
                        actionText: "Okay"
                    });
                }, 500 - (Date.now() - start_time));
            } else if(r.startsWith("you won the")) {
                setTimeout(() => {
                    snackbar.show({
                        message: "Your Element Got Added!",
                        timeout: 1750,
                        
                        actionHandler: ()=>{},
                        actionText: "Okay"
                    });
                    const recipe = suggestRecipe.split("+");
                    processCombo(recipe[0], recipe[1]);
                }, 500 - (Date.now() - start_time));
            }
        });
    });

    let contentEditableNodes = document.querySelectorAll('[contenteditable]');
    if((() => {
        let d = document.createElement("div");
        try {
            d.contentEditable = "PLAINtext-onLY";
        } catch(e) {
            return false;
        }
        return d.contentEditable == "plaintext-only";
    })()) {
        // contenteditble=plaintext-only is supported
        console.debug("[contenteditble=plaintext-only] is supported");
        [].forEach.call(contentEditableNodes, function(div) {
            div.contentEditable = "plaintext-only";
        });
    } else {
        console.debug("[contenteditble=plaintext-only] is not supported");
        // contenteditble=plaintext-only is not supported
        [].forEach.call(contentEditableNodes, function(div) {
            div.addEventListener("paste", function(e) {
                // cancel paste
                e.preventDefault();
                
                // get text representation of clipboard
                var text = e.clipboardData.getData("text/plain");
                
                // insert text manually
                document.execCommand("insertHTML", false, text);
            });
        });
    }

    suggestElemEnter.addEventListener("input", function(){
        submitElement.removeAttribute("disabled");
        
        if(suggestElemEnter.innerText.length > 25)
            submitElement.setAttribute("disabled", "aw man that name is too long!");

        setTimeout(() => {
            suggestElemEnter.style.transform = "translate(0.1px, 0.1px)";
            setTimeout(() => {
                suggestElemEnter.style.transform = "none";
            }, 100);
        }, 50);
    });

    const closebutton = document.querySelector(".close") as HTMLElement;
    const infopanel = document.querySelector(".elem-info-panel");
    closebutton.style.display = "none";
    elementinfo = document.querySelector(".element-info");
    const settings = document.querySelector(".settings-btn") as any;
    const settingsPanel = document.querySelector(".settings");
    new MDCRipple(elementinfo).unbounded = true;
    new MDCRipple(closebutton).unbounded = true;
    new MDCRipple(settings).unbounded = true;
    var pushstate = true;
    elementinfo.onclick = () => {
        if (!held_element) return;
        
        getElementData(held_element).then((elem) => {
            if (!elem.color) {
                elem = {
                    color: "red",
                    display: "404",
                    id: "error",
                    createdOn: Date.now(),
                    creator: "You!",
                    note: "The element you tried to find exists in the future, go and create it!",
                    name_identifier: "404"
                }
            }
            infopanel.classList.remove("awayified");
            closebutton.style.display = "block";
            
            document.getElementById("element-info_title").innerHTML = "Element #" + elem.id;
            document.getElementById("element-info_note").innerHTML = escapeHTML(elem.note) || ""
            document.getElementById("element-info_date").innerHTML = (elem.createdOn) ?
            "Created on " + formatDate(new Date(elem.createdOn)) : "";
            document.getElementById("element-info_element").innerHTML = escapeHTML(elem.display);
            document.getElementById("element-info_element").className = "element " + elem.color;
            
            if (elem.id === 'error') {
                document.getElementById("element-info_title").innerHTML = "Element Not Found";
            } else {
                if (pushstate)
                    history.pushState("",document.title,"#viewelement=" + elem.id);
            }
        });

    };
    settings.onclick = () => {
        settingsPanel.classList.remove("awayified");
        closebutton.style.display = "block";
        if (pushstate)
            history.pushState("", document.title, "#settings");
    }
    window.onpopstate = () => {
        var spot;
        if((spot = location.href.indexOf("#viewelement=")) !== -1) {
            // open it
            settingsPanel.classList.add("awayified");
            held_element = location.href.substr(spot + 13);
            elementinfo.onclick(null);
            held_element = null;
        } else if (location.href.indexOf("#settings") !== -1) {
            infopanel.classList.add("awayified");
            settings.onclick(null);
        } else {
            infopanel.classList.add("awayified");
            settingsPanel.classList.add("awayified");
            closebutton.style.display = "none";
            pushstate = true;
        }
    }
    closebutton.addEventListener("click", () => {
        history.back();
    });

    // settings shit
    const spmb = document.getElementById("sound-pack-menu-btn");
    const aud_packs = getAudioPackList();
    aud_packs.forEach(pack => {
        const li = document.createElement("li");
        li.className = "mdc-list-item add-ripple";
        const span = document.createElement("span");
        span.className = "mdc-list-item__text";
        span.innerHTML = escapeHTML(pack.name);
        li.appendChild(span);

        document.querySelector("#audio-packs-mnt").appendChild(li);
    });
    const spmm = new MDCMenu(document.querySelector('#sound-pack-menu-menu'));
    spmb.onclick = () => {
        spmm.open = true;
    }
    document.querySelector('#sound-pack-menu-menu').addEventListener('MDCMenu:selected', (ev: any) => {
        SetSoundPack(aud_packs[ev.detail.index].name);
        spmm.open = false;
    });
    const tpmb = document.getElementById("theme-pack-menu-btn");
    const theme_packs = getThemeList();
    theme_packs.forEach(pack => {
        const li = document.createElement("li");
        li.className = "mdc-list-item add-ripple";
        const span = document.createElement("span");
        span.className = "mdc-list-item__text";
        span.innerHTML = escapeHTML(pack.name);
        li.appendChild(span);

        document.querySelector("#theme-packs-mnt").appendChild(li);
    });
    const tpmm = new MDCMenu(document.querySelector('#theme-pack-menu-menu'));
    tpmb.onclick = () => {
        tpmm.open = true;
    }
    document.querySelector('#theme-pack-menu-menu').addEventListener('MDCMenu:selected', (ev: any) => {
        SetTheme(theme_packs[ev.detail.index].name);
        tpmm.open = false;
    });
    // adding
    document.querySelector('#sound-pack-menu-add').addEventListener("click", () => {
        const url = prompt("Paste the Sound Pack URL to add it");

        if(url) {
            // get the sound pack
            searchAudioPack(url).then(res => {
                if(res.error !== "success") {
                    alert("Error Getting Audio Pack: " + res.error);
                } else {
                    if (res.pack.name === "Default") return alert("Sound Pack's Name cannot be `Default`");
                    if (res.pack.name === "Classic") return alert("Sound Pack's Name cannot be `Classic`");

                    if(aud_packs.find(x=>x.name === res.pack.name)) {
                        // check if it exists, ask confirm
                        if(!confirm("This will overwrite the `" + res.pack.name + "` sound pack.")) {
                            return;
                        }
                    }

                    // add
                    addPack(res.pack);

                    SetSoundPack(res.pack.name);
                    
                    // reload
                    location.reload();
                }
            });
        }
    });
    document.querySelector('#theme-pack-menu-add').addEventListener("click", () => {
        const url = prompt("Paste the Theme URL to add it");

        if(url) {
            // get the sound pack
            searchTheme(url).then(res => {
                if(res.error !== "success") {
                    alert("Error Getting Theme: " + res.error);
                } else {
                    if (res.pack.name === "Dark") return alert("Theme's Name cannot be `Dark`");
                    if (res.pack.name === "Light") return alert("Theme's Name cannot be `Light`");

                    if(aud_packs.find(x=>x.name === res.pack.name)) {
                        // check if it exists, ask confirm
                        if(!confirm("This will overwrite the `" + res.pack.name + "` theme.")) {
                            return;
                        }
                    }

                    // add
                    AddTheme(res.pack);

                    SetTheme(res.pack.name);
                    
                    // reload
                    location.reload();
                }
            });
        }
    });

    document.querySelectorAll(".add-ripple").forEach(elem => {
        new MDCRipple(elem);
    });

    setInterval(counterUpdate, 60 * 1000);

    document.querySelector(".reset-all").addEventListener("click", ()=>{
        if (confirm("Reset all Game Data, this also includes themes and sound packs.")) {
            localStorage.clear();
            location.reload();
        }
    });
    document.querySelector(".reset-elem").addEventListener("click", ()=>{
        if (confirm("Reset achieved elements.")) {
            localStorage.S = "1S2S3S4";
            localStorage.C = "{}";
            location.reload();
        }
    });
    document.querySelector(".reset-settings").addEventListener("click", ()=>{
        if (confirm("Reset extra content packs. This will remove all sound packs and themes.")) {
            localStorage.audioprofile_selected = "Default";
            localStorage.audioprofiles = JSON.stringify([]);
            localStorage.theme_selected = "Light";
            localStorage.themelist = JSON.stringify([]);
            location.reload();
        }
    });
    function winclose() {
        window.close();
        setTimeout(() => {
            history.replaceState("", document.title, "/#settings");
            location.reload();
        }, 200);
    }
    localStorage.removeItem("reset");
    setInterval(() => {
        if (localStorage.reset) {
            setTimeout(() => {
                localStorage.removeItem("reset");
                location.reload();
            }, 500);
        }
    }, 500);

    if (window["launchStartViewElem"]) {
        setTimeout(() => {
            history.replaceState("", document.title, "#game")
            history.pushState("", document.title, "#viewelement=" + window["launchStartViewElem"]);
            pushstate = false;
            window.onpopstate(null);
        }, 100);
    }
    else if (window["launchStartViewSettings"]) {
        setTimeout(() => {
            history.replaceState("", document.title, "#game")
            history.pushState("", document.title, "#settings");
            pushstate = false;
            window.onpopstate(null);
        }, 100);
    }
    else if (window["launchStartAddPack"]) {
        const array = window["launchStartAddPack"].split(";");
        if (array[0] === "soundpack") {
            // get the sound pack
            document.body.style.display = "none";
            setTimeout(() => {
                searchAudioPack(array[1]).then(res => {
                    if (res.error !== "success") {
                        alert("Error Getting Audio Pack: " + res.error);
                        winclose();
                    } else {
                        if (res.pack.name === "Default") {
                            alert("Sound Pack's Name cannot be `Default`");
                            winclose();
                        }
                        if (res.pack.name === "Classic") {
                            alert("Sound Pack's Name cannot be `Classic`");
                            winclose();
                        }

                        if (aud_packs.find(x => x.name === res.pack.name)) {
                            // check if it exists, ask confirm
                            if (!confirm("This will overwrite the `" + res.pack.name + "` sound pack.")) {
                                winclose();
                                return;
                            }
                        }

                        // add
                        addPack(res.pack);
                        SetSoundPack(res.pack.name);
                        localStorage.reset = "YES";

                        // reload
                        winclose();
                    }
                }).catch(() => {
                    winclose();
                });
            }, 10)
        }
        if (array[0] === "theme") {
            // get the sound pack
            document.body.style.display="none";
            setTimeout(() => {
                searchTheme(array[1]).then(res => {
                    if (res.error !== "success") {
                        alert("Error Getting Theme: " + res.error);
                        winclose();
                    } else {
                        if (res.pack.name === "Light") {
                            alert("Theme's Name cannot be `Light`");
                            winclose();
                        }
                        if (res.pack.name === "Dark") {
                            alert("Theme's Name cannot be `Dark`");
                            winclose();
                        }

                        if (theme_packs.find(x => x.name === res.pack.name)) {
                            // check if it exists, ask confirm
                            if (!confirm("This will overwrite the `" + res.pack.name + "` theme.")) {
                                winclose();
                                return;
                            }
                        }

                        // add
                        AddTheme(res.pack);
                        SetTheme(res.pack.name);
                        localStorage.reset = "YES";

                        // reload
                        winclose();
                    }
                }).catch(() => {
                    winclose();
                });
            }, 10)
        }
    } else {
        history.replaceState("",document.title,"/#game");
    }

}