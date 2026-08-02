/**
 * MapControlPanel.js - Engine-neutral application controls rendered above or beside the map.
 */
import { MapDocumentSelector } from './MapDocumentSelector.js';
import { LayerPanel } from './LayerPanel.js';
import { BaseMapSelector } from './BaseMapSelector.js';
export class MapControlPanel {
  constructor({ api, mapContainer, options }) { this.api=api; this.mapContainer=mapContainer; this.options=options; this.listeners=[]; }
  mount(){
    if(this.options.enabled===false||this.options.placement==='none')return;
    this.element=document.createElement('aside');this.element.className='heurist-map-control-panel';
    if(this.options.position)this.element.classList.add(`position-${this.options.position}`);
    const header=document.createElement('button');header.type='button';header.className='heurist-map-panel-header';header.textContent='Map controls';
    const body=document.createElement('div');body.className='heurist-map-panel-body';header.addEventListener('click',()=>this.element.classList.toggle('collapsed'));
    if(this.options.initiallyExpanded===false)this.element.classList.add('collapsed');
    if(this.options.showMapDocuments!==false){body.append(section('Map documents',this.documentsContainer=document.createElement('div')));}
    if(this.options.showLayers!==false){body.append(section('Layers',this.layersContainer=document.createElement('div')));}
    if(this.options.showBaseMaps!==false){body.append(section('Base maps',this.baseMapsContainer=document.createElement('div')));}
    this.element.append(header,body);
    const target=this.options.placement==='external'&&this.options.containerId?document.getElementById(this.options.containerId):this.mapContainer.parentElement;
    if(target&&globalThis.getComputedStyle?.(target).position==='static')target.style.position='relative';target?.append(this.element);
    this.documentSelector=this.documentsContainer?new MapDocumentSelector({api:this.api,container:this.documentsContainer}):null;
    this.layerPanel=this.layersContainer?new LayerPanel({api:this.api,container:this.layersContainer}):null;
    this.baseMapSelector=this.baseMapsContainer?new BaseMapSelector({api:this.api,container:this.baseMapsContainer}):null;
    this.bind('heurist-map-documents-loaded',()=>this.refresh());this.bind('heurist-map-document-activated',()=>this.refresh());
    this.bind('heurist-map-layer-loaded',()=>this.refreshLayers());this.bind('heurist-map-layer-visibility-changed',()=>this.refreshLayers());
    this.bind('heurist-map-layer-state-changed',()=>this.refreshLayers());this.bind('heurist-map-basemap-changed',()=>this.refresh());this.bind('heurist-map-error',()=>this.refreshLayers());this.refresh();
  }
  bind(name,handler){this.api.addEventListener(name,handler);this.listeners.push([name,handler]);}
  refresh(){this.documentSelector?.render(this.api.getMapDocuments(),this.api.getActiveMapDocument()?.id);this.baseMapSelector?.render(this.api.getBaseMaps(),this.api.getActiveBaseMap()?.id);this.refreshLayers();}
  refreshLayers(){this.layerPanel?.render(this.api.getLayers());}
  destroy(){for(const [n,h]of this.listeners)this.api.removeEventListener(n,h);this.element?.remove();}
}
function section(title,content){const s=document.createElement('section');s.className='heurist-map-panel-section';const h=document.createElement('h3');h.textContent=title;s.append(h,content);return s;}
