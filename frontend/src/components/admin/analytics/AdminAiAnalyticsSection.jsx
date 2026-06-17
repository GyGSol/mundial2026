import AdminStatCard from '../AdminStatCard.jsx';
import { adminMuted } from '../adminTheme.js';
import OracleErrorCurveChart from './OracleErrorCurveChart.jsx';
import GdifTrendChart from './GdifTrendChart.jsx';
import PointsPerMatchChart from './PointsPerMatchChart.jsx';
import HitRateRollingChart from './HitRateRollingChart.jsx';
import GroupPerformanceChart from './GroupPerformanceChart.jsx';
import PhasePerformanceChart from './PhasePerformanceChart.jsx';
import BiasCalibrationChart from './BiasCalibrationChart.jsx';
import RollingBiasChart from './RollingBiasChart.jsx';
import HumanVsAiChart from './HumanVsAiChart.jsx';
import TrainingBufferChart from './TrainingBufferChart.jsx';
import MseDistributionChart from './MseDistributionChart.jsx';
import PredictedActualScatter from './PredictedActualScatter.jsx';
import ModelSourceChart from './ModelSourceChart.jsx';
import CalibrationPipelineChart from './CalibrationPipelineChart.jsx';

function SectionHeading({ title, description }) {
  return (
    <div className="col-span-full mt-2 border-t border-slate-700/60 pt-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {description ? <p className={`mt-1 text-xs ${adminMuted}`}>{description}</p> : null}
    </div>
  );
}

export default function AdminAiAnalyticsSection({ data, loading, error }) {
  const summary = data?.summary ?? null;
  const performance = data?.performance ?? {};
  const calibration = data?.calibration ?? {};
  const training = data?.training ?? {};
  const pipeline = data?.pipeline ?? {};
  const scatter = data?.scatter ?? {};

  const empty = !loading && !summary?.partidos;

  if (empty && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-600/80 bg-slate-900/30 p-8 text-center">
        <p className="text-sm font-medium text-slate-200">Sin datos analíticos todavía</p>
        <p className={`mt-2 text-sm ${adminMuted}`}>
          Los gráficos aparecerán cuando Oracle tenga partidos finalizados y puntuados en el Mundial 2026.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="Partidos analizados"
            value={summary.partidos}
            hint={`Tendencia MSE: ${summary.tendencia}`}
          />
          <AdminStatCard
            label="MSE promedio"
            value={summary.msePromedio ?? '—'}
            hint="Error cuadrático de marcador"
          />
          <AdminStatCard
            label="Gdif combinado"
            value={summary.gdifCombinado ?? '—'}
            hint="Objetivo: 0.000"
          />
          <AdminStatCard
            label="Promedio puntos"
            value={summary.promedioPuntos ?? '—'}
            hint={`${summary.puntosTotales ?? 0} pts · PA ${summary.tasaPa ?? 0}%`}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionHeading
          title="Rendimiento en torneo"
          description="Precisión de marcadores, puntos y aciertos a lo largo del Mundial."
        />

        <div className="col-span-full">
          <OracleErrorCurveChart errorCurve={data?.errorCurve} loading={loading} error={error} />
        </div>
        <GdifTrendChart data={performance.cumulativeGdif} />
        <PointsPerMatchChart data={performance.byMatch} />
        <HitRateRollingChart data={performance.hitRatesRolling} />
        <GroupPerformanceChart data={performance.byGroup} />
        <PhasePerformanceChart data={performance.byPhase} />

        <SectionHeading
          title="Calibración y aprendizaje"
          description="Sesgos detectados, comparación con humanos y buffer de entrenamiento."
        />

        <BiasCalibrationChart data={calibration.biasSeries} />
        <RollingBiasChart data={calibration.rollingBias} />
        <HumanVsAiChart data={calibration.humanVsAi} />
        <TrainingBufferChart data={training.bufferGrowth} />
        <MseDistributionChart data={training.mseHistogram} />

        <SectionHeading
          title="Pipeline del modelo"
          description="Proveedores de IA, calibración automática y dispersión predicho vs real."
        />

        <ModelSourceChart data={pipeline.sourceBreakdown} />
        <CalibrationPipelineChart data={pipeline.calibrationRate} />
        <div className="col-span-full lg:col-span-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminStatCard
              label="Predicciones oficiales"
              value={pipeline.simulationVsOfficial?.official ?? 0}
              hint="Logs no simulación"
            />
            <AdminStatCard
              label="Simulaciones"
              value={pipeline.simulationVsOfficial?.simulation ?? 0}
              hint="Pruebas sin guardar predicción"
            />
          </div>
        </div>
        <PredictedActualScatter data={scatter.predictedVsActual} />
      </div>
    </div>
  );
}
