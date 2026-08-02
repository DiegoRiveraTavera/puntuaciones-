import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({ node: 'http://localhost:9200' });

export const INDEX = 'contenido';

export interface DocContenido {
  title: string;
  description: string;
  route: string;
  type: string;
}

export async function crearIndice() {
  const existe = await esClient.indices.exists({ index: INDEX });
  if (existe) return;

  await esClient.indices.create({
    index: INDEX,
    mappings: {
      properties: {
        title: { type: 'text' },
        description: { type: 'text' },
        route: { type: 'keyword' },
        type: { type: 'keyword' },
      },
    },
  });
}

export async function sembrarDatos() {
  const docs: DocContenido[] = [
    { title: 'Inicio',       description: 'Puntuaciones y escuadras registradas',    route: '/inicio',       type: 'página' },
    { title: 'Formación',    description: 'Información de formación del escuadrón',  route: '/formacion',    type: 'página' },
    { title: 'Juegos',       description: 'Lista de juegos y resultados',            route: '/juegos',       type: 'página' },
    { title: 'Técnica',      description: 'Técnicas registradas y calificadas',      route: '/tecnica',      type: 'página' },
    { title: 'Lugares',      description: 'Ranking y podio de escuadras',            route: '/lugares',      type: 'página' },
    { title: 'Estadísticas', description: 'Gráficas y resumen de desempeño',         route: '/estadisticas', type: 'página' },
    { title: 'Acerca de',    description: 'Quiénes somos y ubicación',               route: '/acerca-de',    type: 'página' },
  ];

  const operations = docs.flatMap(doc => [{ index: { _index: INDEX } }, doc]);
  await esClient.bulk({ refresh: true, operations });
}

export async function buscar(query: string): Promise<DocContenido[]> {
  const resultado = await esClient.search<DocContenido>({
    index: INDEX,
    query: {
      multi_match: {
        query,
        fields: ['title^3', 'description'],
        fuzziness: 'AUTO',
      },
    },
  });

  return resultado.hits.hits.map(h => h._source as DocContenido);
}