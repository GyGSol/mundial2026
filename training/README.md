# Pipeline Oracle — entrenamiento Cerebras CS-3

Este directorio **no se despliega en Heroku**. Ejecutá los pasos en AI Model Studio o un entorno con `cszoo` instalado.

## 1. Exportar buffer desde Mongo

```bash
npm run oracle:export
```

## 2. Generar JSONL

```bash
npm run oracle:preprocess
```

## 3. Preprocesar a HDF5

```bash
pip install -r training/requirements.txt
# Instalar cerebras_modelzoo según documentación de tu cluster
cszoo data_preprocess run --config training/configs/train_data_config.yaml
cszoo data_preprocess run --config training/configs/valid_data_config.yaml
```

## 4. Fine-tuning

Ajustá rutas en `training/configs/finetune_oracle_llama.yaml` y lanzá el job de entrenamiento según el tutorial de Cerebras:

- [Fine-tune your first model](https://training-docs.cerebras.ai/rel-2.5.0/getting-started/fine-tune-your-first-model)
- [Data preprocessing](https://training-docs.cerebras.ai/rel-2.10.0/model-zoo/core-workflows/quickstart-guide-for-data-preprocessing)

El read hook `training/hooks/oracle_mse_read_hook.py` pondera muestras con mayor MSE y fases eliminatorias.
