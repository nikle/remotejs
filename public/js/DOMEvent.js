/**
 * Created by guoquanwu on 14-6-2.
 */

var knownValidLevel1Event={};
var _clematisReplacementDescriptors= {};
var alreadyOverwritten = {};


document.addEventListener("DOMContentLoaded",function replaceDOMLevel1ForAll(){
    var allElements = document.querySelectorAll("*");

    this.removeEventListener("DOMContentLoaded",replaceDOMLevel1ForAll,false);

    for(var i =0; i<allElements.length; ++i){
        overrideDOMLevel1Event(allElements[i]);
    }
},false);

//overrideDOMLevel1Event(document);
//overrideDOMLevel1Event(window);


function overrideDOMLevel1Event(object){

    //modified by guoquan
    if(object.hasOwnProperty("_ReplaceLevel1Event")){
        return;
    }
    // as the properties of this object may have change, so we need to check the object again when the such object is used;

    var validEvents = getLevel1Event(object);
    var singleEvent;
    var defaultEvent;
    var j;

    for(j = 0; j<validEvents.length;++j){
        singleEvent = validEvents[j];

        var flag = object.hasOwnProperty(singleEvent);

        defaultEvent = object[singleEvent];
        if(defaultEvent && singleEvent !=="onload"){
            object[singleEvent] = null;
        }

        //modified by guoquan
        if(!_clematisReplacementDescriptors.hasOwnProperty(singleEvent)){
            _clematisReplacementDescriptors[singleEvent]=generateReplacementLevel1Event(singleEvent);
        }

        _clematisReplacementDescriptors[singleEvent]=generateReplacementLevel1Event(singleEvent);

        Object.defineProperty(object,singleEvent,_clematisReplacementDescriptors[singleEvent]);

        if(defaultEvent||flag){
            object[singleEvent] = defaultEvent;//invoke the new set function;
        }
    }

    Object.defineProperty(object,"_ReplaceLevel1Event",{
        value:1,
        configurable:true,
        enumerable:false,
        writable:false
    });

    return;

}

function generateReplacementLevel1Event(level1Event){
    var eventType = level1Event.substring(2);
    level1Event = "_clematis" + level1Event;

    return{
        configurable: true,
        enumerable: false,
        get: function(){
            return this[level1Event];
        },
        set: function(arg0){

            if(this.id === "l24" && level1Event === "_clematisonmouseout"){
                console.log("testing !!!!!");
            }

            if(this.id === "l24" && level1Event === "_clematisonmouseover"){
                console.log("testing !!!!!");
            }

            if(this.id === "l24" && level1Event === "_clematisonclick"){
                console.log("testing !!!!!!!!!!!");
            }

             if(this.id === "l35" && level1Event === "_clematisonmouseout"){
                console.log("testing !!!!!");
            }

            if(this.id === "l35" && level1Event === "_clematisonmouseover"){
                console.log("testing !!!!!");
            }

            if(this.id === "l35" && level1Event === "_clematisonclick"){
                console.log("testing !!!!!!!!!!!");
            }

            if(typeof this[level1Event] != "undefined"){
                this.removeEventListener(eventType,this[level1Event],false);
            }         
            if(Object.prototype.toString.apply(arg0)=="[object Function]" ){
                arg0 = this.addEventListener(eventType,arg0,false);
            }

            Object.defineProperty(this,level1Event,{
                value:arg0,
                configurable:true,
                enumerable:false,
                writable:true
            });

            return arg0;
        }
    }
}

function getLevel1Event(object){

    var objectName = object.constructor.name;
    var propertiesToBeReturned =[];

    if(knownValidLevel1Event.hasOwnProperty(objectName)){
        return knownValidLevel1Event[objectName];
    }

    //all on.... properties are stored;
    var objectProperties = Object.getOwnPropertyNames(object);


   /* if(!(object instanceof  Node)){
        replaceListenerAdder(Object.getPrototypeOf(object),objectName);
    }*/

    for (var i =0; i< objectProperties.length;++i){
        var currentProp = objectProperties[i];
        if(currentProp.indexOf("on")==0 && propertiesToBeReturned.indexOf(currentProp)==-1){
            propertiesToBeReturned.push(currentProp);
        }
    }

    knownValidLevel1Event[objectName] = propertiesToBeReturned;

    return propertiesToBeReturned;
}

