# PDF fonts

Noto Sans Devanagari includes Latin, Devanagari, punctuation and the rupee sign.
Source: https://github.com/google/fonts/tree/main/ofl/notosansdevanagari
Licensed under the SIL Open Font License (OFL.txt).

Regular and bold are static instances of the upstream `NotoSansDevanagari[wdth,wght].ttf`,
generated with fonttools 4.64.0 at wdth=100 and wght=400/700. The current font
was tested with PDFKit/fontkit, including the Hindi sequence `है।`; the older
noto-fonts static release has an incompatible GPOS anchor for that sequence.
