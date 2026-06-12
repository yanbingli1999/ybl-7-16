import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, TrendingDown, Crosshair, Lightbulb, ChevronRight } from 'lucide-react';
import type { SimulationResult } from '../../shared/types.js';
import { formatNumber, formatPercentage } from '../../shared/monteCarlo.js';

interface Props {
  sim: SimulationResult;
}

interface RiskInsight {
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  titleColor: string;
  content: string;
}

function generateInsights(sim: SimulationResult): RiskInsight[] {
  const insights: RiskInsight[] = [];
  const { lossProbability, var95, threshold, mean, stdDev, sensitivity, percentiles, min } = sim;

  const topVar = sensitivity.length > 0 ? sensitivity[0] : null;
  const secondVar = sensitivity.length > 1 ? sensitivity[1] : null;
  const thresholdVsMedian = threshold - percentiles.p50;

  if (lossProbability < 0.05) {
    insights.push({
      icon: ShieldCheck,
      iconColor: 'text-monte-safe',
      iconBg: 'bg-monte-safe/15',
      title: '亏损风险极低',
      titleColor: 'text-monte-safe',
      content: `模拟结果仅有 ${formatPercentage(lossProbability)} 的概率低于阈值 ${formatNumber(threshold, 0)}，项目预期结果远在安全区间内，当前参数配置下整体风险可控。`,
    });
  } else if (lossProbability < 0.15) {
    insights.push({
      icon: ShieldCheck,
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-500/15',
      title: '亏损风险较低',
      titleColor: 'text-emerald-300',
      content: `亏损概率为 ${formatPercentage(lossProbability)}，约每 ${Math.round(1 / Math.max(lossProbability, 0.001))} 次模拟出现 1 次低于阈值的情况。风险在可接受范围内，但仍需关注尾部极端情景。`,
    });
  } else if (lossProbability < 0.3) {
    insights.push({
      icon: AlertTriangle,
      iconColor: 'text-monte-warn',
      iconBg: 'bg-monte-warn/15',
      title: '存在明显亏损风险',
      titleColor: 'text-monte-warn',
      content: `亏损概率达到 ${formatPercentage(lossProbability)}，即约每 ${Math.round(1 / Math.max(lossProbability, 0.001))} 次模拟中有 ${Math.round(lossProbability * 10)} 次可能亏损。阈值 ${formatNumber(threshold, 0)} 距离中位数 ${formatNumber(percentiles.p50, 0)} ${thresholdVsMedian > 0 ? '偏上' : '偏下'}，说明结果分布与期望之间存在不小偏移。`,
    });
  } else if (lossProbability < 0.5) {
    insights.push({
      icon: AlertTriangle,
      iconColor: 'text-monte-warn',
      iconBg: 'bg-monte-warn/15',
      title: '亏损风险偏高',
      titleColor: 'text-monte-warn',
      content: `亏损概率高达 ${formatPercentage(lossProbability)}，接近一半的模拟结果低于阈值 ${formatNumber(threshold, 0)}。中位结果 ${formatNumber(percentiles.p50, 0)} 已处于亏损区间，项目在当前配置下盈利压力较大。`,
    });
  } else {
    insights.push({
      icon: AlertTriangle,
      iconColor: 'text-monte-danger',
      iconBg: 'bg-monte-danger/15',
      title: '亏损风险极高',
      titleColor: 'text-monte-danger',
      content: `亏损概率高达 ${formatPercentage(lossProbability)}，超过半数模拟结果低于阈值 ${formatNumber(threshold, 0)}。项目在当前参数配置下大概率亏损，建议立即重新评估方案。`,
    });
  }

  const tailLoss = mean - var95;
  if (tailLoss > stdDev * 0.5) {
    insights.push({
      icon: TrendingDown,
      iconColor: 'text-monte-danger',
      iconBg: 'bg-monte-danger/15',
      title: '尾部损失严重',
      titleColor: 'text-monte-danger',
      content: `最坏 5% 情景下，结果仅为 ${formatNumber(var95, 0)}，相比均值 ${formatNumber(mean, 0)} 偏离 ${formatNumber(Math.abs(tailLoss), 0)}（约 ${formatNumber(Math.abs(tailLoss) / Math.abs(mean || 1) * 100, 1)}%）。极端下行风险显著，尾部损失远超正常波动范围。`,
    });
  } else if (tailLoss > stdDev * 0.2) {
    insights.push({
      icon: TrendingDown,
      iconColor: 'text-monte-warn',
      iconBg: 'bg-monte-warn/15',
      title: '尾部损失需关注',
      titleColor: 'text-monte-warn',
      content: `最坏 5% 情景下结果为 ${formatNumber(var95, 0)}，偏离均值 ${formatNumber(Math.abs(tailLoss), 0)}。尾部下行虽然可控，但极端情况下损失仍值得警惕，最坏可能到 ${formatNumber(min, 0)}。`,
    });
  } else {
    insights.push({
      icon: TrendingDown,
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-500/15',
      title: '尾部风险可控',
      titleColor: 'text-emerald-300',
      content: `最坏 5% 情景下结果为 ${formatNumber(var95, 0)}，与均值 ${formatNumber(mean, 0)} 的偏差为 ${formatNumber(Math.abs(tailLoss), 0)}，下行风险在合理范围内。`,
    });
  }

  if (topVar) {
    const topContribution = topVar.contribution;
    const isTopNegative = topVar.correlation < 0;
    let sensitivityMsg = '';

    if (topContribution > 40) {
      sensitivityMsg = `「${topVar.variableName}」对结果影响最大，贡献度达 ${formatNumber(topContribution, 1)}%，${isTopNegative ? '与结果负相关——该变量越大，总结果越差' : '与结果正相关——该变量越大，总结果越好'}。`;
      if (secondVar) {
        sensitivityMsg += `其次为「${secondVar.variableName}」(${formatNumber(secondVar.contribution, 1)}%)，两者合计贡献 ${formatNumber(topContribution + secondVar.contribution, 1)}%。`;
      }
      sensitivityMsg += isTopNegative
        ? '风险主要来自该变量的上行压力，应优先控制其最大值。'
        : '收益高度依赖该变量，其下行将严重影响项目表现，应重点保障其最小值。';
    } else if (topContribution > 20) {
      sensitivityMsg = `「${topVar.variableName}」贡献度 ${formatNumber(topContribution, 1)}%，${isTopNegative ? '为负向驱动因素' : '为正向驱动因素'}。`;
      if (secondVar) {
        sensitivityMsg += `「${secondVar.variableName}」紧随其后 (${formatNumber(secondVar.contribution, 1)}%)。`;
      }
      sensitivityMsg += '风险来源较分散，建议综合调整多个关键变量。';
    } else {
      sensitivityMsg = '各变量对结果的影响较为均匀，没有单一主导因素，风险来源于多个变量的共同波动，需全面优化。';
    }

    insights.push({
      icon: Crosshair,
      iconColor: topContribution > 40 ? 'text-monte-danger' : topContribution > 20 ? 'text-monte-warn' : 'text-monte-accent',
      iconBg: topContribution > 40 ? 'bg-monte-danger/15' : topContribution > 20 ? 'bg-monte-warn/15' : 'bg-monte-accent/15',
      title: '敏感变量分析',
      titleColor: topContribution > 40 ? 'text-monte-danger' : topContribution > 20 ? 'text-monte-warn' : 'text-monte-accent',
      content: sensitivityMsg,
    });
  }

  if (topVar) {
    const isNegative = topVar.correlation < 0;
    let recommendation = '';

    if (isNegative) {
      recommendation = `优先调整「${topVar.variableName}」：该变量为负相关且贡献最大，缩小其最大值（当前上限）或降低其最可能值，可直接降低亏损概率。`;
      if (secondVar && secondVar.correlation < 0 && secondVar.contribution > 15) {
        recommendation += `同时考虑优化「${secondVar.variableName}」的上限，进一步压缩下行空间。`;
      }
    } else {
      recommendation = `优先保障「${topVar.variableName}」：该变量为正相关且贡献最大，提高其最可能值或抬高其最小值，可显著改善项目预期。`;
      if (secondVar && secondVar.correlation > 0 && secondVar.contribution > 15) {
        recommendation += `同时关注「${secondVar.variableName}」的下行风险，避免其跌至最小值。`;
      }
    }

    if (lossProbability > 0.3) {
      recommendation += ` 此外，当前亏损概率偏高，可考虑提高阈值设定或引入风险缓解措施。`;
    }

    insights.push({
      icon: Lightbulb,
      iconColor: 'text-amber-300',
      iconBg: 'bg-amber-500/15',
      title: '优先调整建议',
      titleColor: 'text-amber-300',
      content: recommendation,
    });
  }

  return insights;
}

export default function RiskExplanationCard({ sim }: Props) {
  const insights = useMemo(() => generateInsights(sim), [sim]);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-amber-300" />
        风险解读
      </h3>
      <div className="space-y-3">
        {insights.map((insight, idx) => {
          const Icon = insight.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-xl bg-monte-bg/60 border border-monte-border/50 hover:border-monte-border transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${insight.iconBg} flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${insight.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ChevronRight className={`w-3.5 h-3.5 ${insight.iconColor}`} />
                    <span className={`text-sm font-semibold ${insight.titleColor}`}>{insight.title}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{insight.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
