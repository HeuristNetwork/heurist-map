/**
 * MapDocumentListProvider.js - Search lightweight MapDocument records.
 *
 * @project Heurist mapping application
 * @license https://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
 */
const MAP_DOCUMENT_CONCEPT_CODE = '3-1019';

export class MapDocumentListProvider {
  constructor({ apiClient, recordTypes }) {
    this.apiClient = apiClient;
    this.recordTypes = recordTypes;
  }

  async search(query = null, { signal } = {}) {
    const recordTypeId = await this.recordTypes.getIdByConceptCode(
      MAP_DOCUMENT_CONCEPT_CODE, { signal }
    );
    const request = normalizeDocumentQuery(query, recordTypeId);
    const payload = await this.apiClient.get('/records/', {
      query: { fields: 'rec_Title', ...request }, signal
    });
    return {
      items: normalizeRecords(payload?.records),
      pagination: payload?.pagination ?? null,
      recordTypeId
    };
  }
}

function normalizeDocumentQuery(query, recordTypeId) {
  if (query == null || query === '') return { q: `t:${recordTypeId}` };
  if (Array.isArray(query)) return { ids: query.join(',') };
  if (typeof query === 'number') return { ids: String(query) };
  if (typeof query === 'string') {
    const value = query.trim();
    if (/^\d+(?:\s*,\s*\d+)*$/.test(value)) return { ids: value.replace(/\s+/g, '') };
    return { q: value };
  }
  if (typeof query === 'object') {
    if (Array.isArray(query.ids)) return { ...query, ids: query.ids.join(',') };
    return { ...query };
  }
  throw new TypeError('MapDocument query must be null, IDs, a Heurist query, or an object');
}

function normalizeRecords(records) {
  return Array.isArray(records) ? records.map((record) => ({
    id: Number(record.rec_ID),
    recordTypeId: Number(record.rec_RecTypeID),
    title: String(record.rec_Title || `Map document ${record.rec_ID}`)
  })).filter((item) => Number.isInteger(item.id) && item.id > 0) : [];
}
