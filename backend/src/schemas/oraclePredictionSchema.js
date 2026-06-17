/** JSON Schema estricto para salidas Oracle (Cerebras structured outputs). */
export const ORACLE_PREDICTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    predicted_score: {
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 10 },
      minItems: 2,
      maxItems: 2,
    },
    confidence_interval: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    key_variable_impact: { type: 'string' },
    error_reduction_factor: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
  },
  required: [
    'predicted_score',
    'confidence_interval',
    'key_variable_impact',
    'error_reduction_factor',
  ],
  additionalProperties: false,
};

export const ORACLE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'oracle_prediction',
    strict: true,
    schema: ORACLE_PREDICTION_JSON_SCHEMA,
  },
};
