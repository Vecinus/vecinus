import { Acta } from "@/types/acta";

export const MOCK_ACTAS: Acta[] = [
  {
    id: "a1",
    title: "Junta Ordinaria - Enero 2024",
    date: "2024-01-15",
    executiveSummary:
      "Se celebró la Junta Ordinaria con asistencia del 78% de los propietarios. Se trataron los presupuestos del ejercicio 2024, la renovación del ascensor del bloque A y el cambio de horarios de la piscina para la temporada de verano.",
    agreements: [
      "Aprobación de presupuestos 2024 con incremento del 3%",
      "Renovación del ascensor del bloque A por unanimidad (presupuesto: 15.000€)",
      "Nuevo horario de piscina: 10:00-21:00 (junio-septiembre)",
      "Contratación de empresa de jardinería trimestral",
    ],
    transcript:
      "El presidente abre la sesión a las 19:00 horas con la asistencia del 78% de los propietarios. Se procede a la lectura del orden del día.\n\nPunto 1 - Presupuestos 2024: El administrador presenta los presupuestos con un incremento del 3% respecto al año anterior, justificado por el aumento de costes energéticos. Se somete a votación y se aprueba por mayoría.\n\nPunto 2 - Renovación ascensor: Se presentan tres presupuestos. Se acuerda por unanimidad aceptar el de la empresa Elevadores Madrid S.L. por 15.000€.\n\nPunto 3 - Horario piscina: Tras debate, se acuerda mantener el horario de 10:00 a 21:00.\n\nSe levanta la sesión a las 20:45 horas.",
    createdBy: "Carlos García",
    status: "published",
  },
  {
    id: "a2",
    title: "Junta Extraordinaria - Diciembre 2023",
    date: "2023-12-10",
    executiveSummary:
      "Junta extraordinaria convocada para tratar la avería urgente del sistema de calefacción central. Se aprobó la reparación con carácter urgente y una derrama para cubrir los costes.",
    agreements: [
      "Contratación urgente de reparación de calefacción (8.500€)",
      "Derrama de 50€ por vivienda",
      "Plazo de pago: 30 días",
    ],
    transcript:
      "Se convoca junta extraordinaria por avería del sistema de calefacción central. El administrador expone la situación y presenta el presupuesto de reparación. Se aprueba por mayoría la derrama de 50€ por vivienda.",
    createdBy: "Carlos García",
    status: "published",
  },
];
