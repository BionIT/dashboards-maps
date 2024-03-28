/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Map as Maplibre } from 'maplibre-gl';
import classNames from 'classnames';
import { GeoShapeRelation } from '@opensearch-project/opensearch/api/types';
import { SimpleSavedObject } from '../../../../../src/core/public';
import { MapContainer } from '../map_container';
import { MapTopNavMenu } from '../map_top_nav';
import { MapServices } from '../../types';
import { useOpenSearchDashboards } from '../../../../../src/plugins/opensearch_dashboards_react/public';
import { MapSavedObjectAttributes } from '../../../common/map_saved_object_attributes';
import {
  DASHBOARDS_MAPS_LAYER_TYPE,
  MAP_LAYER_DEFAULT_NAME,
  OPENSEARCH_MAP_LAYER,
} from '../../../common';
import { MapLayerSpecification } from '../../model/mapLayerType';
import { getLayerConfigMap, getInitialMapState } from '../../utils/getIntialConfig';
import {
  Filter,
  IndexPattern,
  RefreshInterval,
  TimeRange,
  Query,
} from '../../../../../src/plugins/data/public';
import { MapState } from '../../model/mapState';
import { GeoShapeFilterMeta, ShapeFilter } from '../../../../../src/plugins/data/common';
import { buildGeoShapeFilterMeta } from '../../model/geo/filter';
import { FilterBar } from '../filter_bar/filter_bar';
import { getDataLayers } from '../../model/layersFunctions';

export interface DashboardProps {
  timeRange?: TimeRange;
  refreshConfig?: RefreshInterval;
  filters?: Filter[];
  query?: Query;
}

interface MapComponentProps {
  mapIdFromSavedObject: string;
  dashboardProps?: DashboardProps;
}

export const MapComponent = ({ mapIdFromSavedObject, dashboardProps }: MapComponentProps) => {
  const { services } = useOpenSearchDashboards<MapServices>();
  const {
    savedObjects: { client: savedObjectsClient },
  } = services;
  const [layers, setLayers] = useState<MapLayerSpecification[]>([]);
  const [savedMapObject, setSavedMapObject] = useState<SimpleSavedObject<
    MapSavedObjectAttributes
  > | null>();
  const [layersIndexPatterns, setLayersIndexPatterns] = useState<IndexPattern[]>([]);
  const maplibreRef = useRef<Maplibre | null>(null);
  const [mapState, setMapState] = useState<MapState>(getInitialMapState());
  const [isUpdatingLayerRender, setIsUpdatingLayerRender] = useState(true);
  const isReadOnlyMode = !!dashboardProps;
  const [dataSourceRefIds, setDataSourceRefIds] = useState<string[]|undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const remoteDataSourceIds: string[] = [];
    if (mapIdFromSavedObject) {
      savedObjectsClient.get<MapSavedObjectAttributes>('map', mapIdFromSavedObject).then((res) => {
        setSavedMapObject(res);
        const layerList: MapLayerSpecification[] = JSON.parse(res.attributes.layerList as string);
        const savedMapState: MapState = JSON.parse(res.attributes.mapState as string);
        setMapState(savedMapState);
        const savedIndexPatterns: IndexPattern[] = [];
        console.log(layerList);
        const indexPatternIds = layerList.filter((layer) => layer.type === DASHBOARDS_MAPS_LAYER_TYPE.DOCUMENTS)
        .map((layer) => layer.source.indexPatternId);
        console.log(indexPatternIds);

        const fetchDs = async() => {
          const requests = layerList.filter((layer) => layer.type === DASHBOARDS_MAPS_LAYER_TYPE.DOCUMENTS)
          .map((layer) => services.data.indexPatterns.get(layer.source.indexPatternId));
          const resp = await Promise.all(requests);
          console.log("Resp", resp);
          resp.forEach((response) => {
            savedIndexPatterns.push(response);
            if (response.dataSourceRef) {
              remoteDataSourceIds.push(response.dataSourceRef.id);
            }
          })

          console.log(remoteDataSourceIds, 'Print-----remoteDataSourceIds-----');
          setLayers(layerList);
          setLayersIndexPatterns(savedIndexPatterns);
          console.log("when did", remoteDataSourceIds.length);
          setDataSourceRefIds(remoteDataSourceIds);
          setIsLoading(false);
        }

        fetchDs();
      
      })
      
    } else {
      const initialDefaultLayer: MapLayerSpecification = getLayerConfigMap()[
        OPENSEARCH_MAP_LAYER.type
      ] as MapLayerSpecification;
      initialDefaultLayer.name = MAP_LAYER_DEFAULT_NAME;
      setLayers([initialDefaultLayer]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSpatialFilter = (
    shape: ShapeFilter,
    label: string | null,
    relation: GeoShapeRelation
  ) => {
    const filterMeta: GeoShapeFilterMeta = buildGeoShapeFilterMeta(label, shape, relation);
    const geoShapeFilterMeta: GeoShapeFilterMeta[] = mapState.spatialMetaFilters || [];
    setMapState({
      ...mapState,
      spatialMetaFilters: [...geoShapeFilterMeta, filterMeta],
    });
  };

  const onFiltersUpdated = (newFilters: GeoShapeFilterMeta[]) => {
    setMapState({
      ...mapState,
      spatialMetaFilters: [...newFilters],
    });
  };

  const filterGroupClasses = classNames('globalFilterGroup__wrapper', {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'globalFilterGroup__wrapper-isVisible': !!mapState.spatialMetaFilters?.length,
  });

  if (!isLoading) {
    console.log(isLoading, "isLoading", dataSourceRefIds?.length)
  }

  console.log("how many times")

  return (
    <div className="map-page">
      {isReadOnlyMode || isLoading ? null : (
        <MapTopNavMenu
          mapIdFromUrl={mapIdFromSavedObject}
          savedMapObject={savedMapObject}
          layers={layers}
          layersIndexPatterns={layersIndexPatterns}
          maplibreRef={maplibreRef}
          mapState={mapState}
          setMapState={setMapState}
          setIsUpdatingLayerRender={setIsUpdatingLayerRender}
          dataSourceRefIds={dataSourceRefIds}
        />
      )}
      {!isReadOnlyMode && !!mapState.spatialMetaFilters?.length && (
        <div id="SpatiallFilterGroup" className="globalQueryBar">
          <div className={filterGroupClasses}>
            <FilterBar
              className="globalFilterGroup__filterBar"
              filters={mapState.spatialMetaFilters}
              onFiltersUpdated={onFiltersUpdated}
            />
          </div>
        </div>
      )}
      <MapContainer
        layers={layers}
        setLayers={setLayers}
        layersIndexPatterns={layersIndexPatterns}
        setLayersIndexPatterns={setLayersIndexPatterns}
        maplibreRef={maplibreRef}
        mapState={mapState}
        isReadOnlyMode={isReadOnlyMode}
        dashboardProps={dashboardProps}
        isUpdatingLayerRender={isUpdatingLayerRender}
        setIsUpdatingLayerRender={setIsUpdatingLayerRender}
        addSpatialFilter={addSpatialFilter}
        dataSourceRefIds={dataSourceRefIds}
        setDataSourceRefIds={setDataSourceRefIds}
      />
    </div>
  );
};

export const MapPage = () => {
  console.log("render here?")
  const { id: mapId } = useParams<{ id: string }>();
  return <MapComponent mapIdFromSavedObject={mapId} />;
};
