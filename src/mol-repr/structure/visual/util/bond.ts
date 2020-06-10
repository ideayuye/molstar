/**
 * Copyright (c) 2018-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { BondType } from '../../../../mol-model/structure/model/types';
import { Unit, StructureElement, Structure, Bond } from '../../../../mol-model/structure';
import { ParamDefinition as PD } from '../../../../mol-util/param-definition';
import { LocationIterator } from '../../../../mol-geo/util/location-iterator';
import { StructureGroup } from '../../units-visual';
import { LinkCylinderParams, LinkParams } from './link';
import { ObjectKeys } from '../../../../mol-util/type-helpers';
import { PickingId } from '../../../../mol-geo/geometry/picking';
import { EmptyLoci, Loci } from '../../../../mol-model/loci';
import { Interval, OrderedSet } from '../../../../mol-data/int';

export const BondParams = {
    includeTypes: PD.MultiSelect(ObjectKeys(BondType.Names), PD.objectToOptions(BondType.Names)),
    excludeTypes: PD.MultiSelect([] as BondType.Names[], PD.objectToOptions(BondType.Names)),
};
export const DefaultBondProps = PD.getDefaultValues(BondParams);
export type BondProps = typeof DefaultBondProps

export const BondCylinderParams = {
    ...LinkCylinderParams,
    ...BondParams
};
export const DefaultBondCylinderProps = PD.getDefaultValues(BondCylinderParams);
export type BondCylinderProps = typeof DefaultBondCylinderProps

export const BondLineParams = {
    ...LinkParams,
    ...BondParams
};
export const DefaultBondLineProps = PD.getDefaultValues(BondLineParams);
export type BondLineProps = typeof DefaultBondLineProps

export function ignoreBondType(include: BondType.Flag, exclude: BondType.Flag, f: BondType.Flag) {
    return !BondType.is(include, f) || BondType.is(exclude, f);
}

export namespace BondIterator {
    export function fromGroup(structureGroup: StructureGroup): LocationIterator {
        const { group, structure } = structureGroup;
        const unit = group.units[0];
        const groupCount = Unit.isAtomic(unit) ? unit.bonds.edgeCount * 2 : 0;
        const instanceCount = group.units.length;
        const location = StructureElement.Location.create(structure);
        const getLocation = (groupIndex: number, instanceIndex: number) => {
            const unit = group.units[instanceIndex];
            location.unit = unit;
            location.element = unit.elements[(unit as Unit.Atomic).bonds.a[groupIndex]];
            return location;
        };
        return LocationIterator(groupCount, instanceCount, getLocation);
    }

    export function fromStructure(structure: Structure): LocationIterator {
        const groupCount = structure.interUnitBonds.edgeCount;
        const instanceCount = 1;
        const location = StructureElement.Location.create(structure);
        const getLocation = (groupIndex: number) => {
            const bond = structure.interUnitBonds.edges[groupIndex];
            location.unit = bond.unitA;
            location.element = bond.unitA.elements[bond.indexA];
            return location;
        };
        return LocationIterator(groupCount, instanceCount, getLocation, true);
    }
}

//

export function getIntraBondLoci(pickingId: PickingId, structureGroup: StructureGroup, id: number) {
    const { objectId, instanceId, groupId } = pickingId;
    if (id === objectId) {
        const { structure, group } = structureGroup;
        const unit = group.units[instanceId];
        if (Unit.isAtomic(unit)) {
            return Bond.Loci(structure, [
                Bond.Location(
                    structure, unit, unit.bonds.a[groupId] as StructureElement.UnitIndex,
                    structure, unit, unit.bonds.b[groupId] as StructureElement.UnitIndex
                ),
                Bond.Location(
                    structure, unit, unit.bonds.b[groupId] as StructureElement.UnitIndex,
                    structure, unit, unit.bonds.a[groupId] as StructureElement.UnitIndex
                )
            ]);
        }
    }
    return EmptyLoci;
}

export function eachIntraBond(loci: Loci, structureGroup: StructureGroup, apply: (interval: Interval) => boolean, isMarking: boolean) {
    let changed = false;
    if (Bond.isLoci(loci)) {
        const { structure, group } = structureGroup;
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        const unit = group.units[0];
        if (!Unit.isAtomic(unit)) return false;
        const groupCount = unit.bonds.edgeCount * 2;
        for (const b of loci.bonds) {
            const unitIdx = group.unitIndexMap.get(b.aUnit.id);
            if (unitIdx !== undefined) {
                const idx = unit.bonds.getDirectedEdgeIndex(b.aIndex, b.bIndex);
                if (idx !== -1) {
                    if (apply(Interval.ofSingleton(unitIdx * groupCount + idx))) changed = true;
                }
            }
        }
    } else if (StructureElement.Loci.is(loci)) {
        const { structure, group } = structureGroup;
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        const unit = group.units[0];
        if (!Unit.isAtomic(unit)) return false;
        const groupCount = unit.bonds.edgeCount * 2;
        for (const e of loci.elements) {
            const unitIdx = group.unitIndexMap.get(e.unit.id);
            if (unitIdx !== undefined) {
                const { offset, b } = unit.bonds;
                OrderedSet.forEach(e.indices, v => {
                    for (let t = offset[v], _t = offset[v + 1]; t < _t; t++) {
                        if (!isMarking || OrderedSet.has(e.indices, b[t])) {
                            if (apply(Interval.ofSingleton(unitIdx * groupCount + t))) changed = true;
                        }
                    }
                });
            }
        }
    }
    return changed;
}

//

export function getInterBondLoci(pickingId: PickingId, structure: Structure, id: number) {
    const { objectId, groupId } = pickingId;
    if (id === objectId) {
        const bond = structure.interUnitBonds.edges[groupId];
        return Bond.Loci(structure, [
            Bond.Location(
                structure, bond.unitA, bond.indexA as StructureElement.UnitIndex,
                structure, bond.unitB, bond.indexB as StructureElement.UnitIndex
            ),
            Bond.Location(
                structure, bond.unitB, bond.indexB as StructureElement.UnitIndex,
                structure, bond.unitA, bond.indexA as StructureElement.UnitIndex
            )
        ]);
    }
    return EmptyLoci;
}

export function eachInterBond(loci: Loci, structure: Structure, apply: (interval: Interval) => boolean, isMarking: boolean) {
    let changed = false;
    if (Bond.isLoci(loci)) {
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        for (const b of loci.bonds) {
            const idx = structure.interUnitBonds.getBondIndexFromLocation(b);
            if (idx !== -1) {
                if (apply(Interval.ofSingleton(idx))) changed = true;
            }
        }
    } else if (StructureElement.Loci.is(loci)) {
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        if (loci.elements.length === 1) return false; // only a single unit

        const map = new Map<number, OrderedSet<StructureElement.UnitIndex>>();
        for (const e of loci.elements) map.set(e.unit.id, e.indices);

        for (const e of loci.elements) {
            const { unit } = e;
            if (!Unit.isAtomic(unit)) continue;
            structure.interUnitBonds.getConnectedUnits(unit).forEach(b => {
                const otherLociIndices = map.get(b.unitB.id);
                if (otherLociIndices) {
                    OrderedSet.forEach(e.indices, v => {
                        if (!b.connectedIndices.includes(v)) return;
                        b.getEdges(v).forEach(bi => {
                            if (!isMarking || OrderedSet.has(otherLociIndices, bi.indexB)) {
                                const idx = structure.interUnitBonds.getEdgeIndex(v, unit, bi.indexB, b.unitB);
                                if (apply(Interval.ofSingleton(idx))) changed = true;
                            }
                        });
                    });
                }
            });
        }
    }
    return changed;
}